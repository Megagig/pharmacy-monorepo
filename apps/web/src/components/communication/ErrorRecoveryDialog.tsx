import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  IconButton,
  Collapse,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  Close,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  ExpandMore,
  ExpandLess,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import {
  CommunicationError,
  ErrorAction,
} from '../../services/communicationErrorService';
import { retryMechanism } from '../../utils/retryMechanism';

interface ErrorRecoveryDialogProps {
  open: boolean;
  error: CommunicationError | null;
  onClose: () => void;
  onRetry?: () => Promise<void>;
  onRecover?: () => void;
  showTechnicalDetails?: boolean;
}

interface RecoveryStep {
  id: string;
  label: string;
  description: string;
  action: () => Promise<boolean>;
  completed: boolean;
  inProgress: boolean;
  optional: boolean;
}

/**
 * User-friendly error recovery dialog with guided recovery steps
 * Provides clear explanations, actionable solutions, and automated recovery options
 */
const ErrorRecoveryDialog: React.FC<ErrorRecoveryDialogProps> = ({
  open,
  error,
  onClose,
  onRetry,
  onRecover,
  showTechnicalDetails = false,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [recoverySteps, setRecoverySteps] = useState<RecoveryStep[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [autoRecoveryInProgress, setAutoRecoveryInProgress] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState(0);

  // Generate recovery steps based on error type
  useEffect(() => {
    if (!error) {
      setRecoverySteps([]);
      return;
    }

    const steps = generateRecoverySteps(error);
    setRecoverySteps(steps);
    setActiveStep(0);
  }, [error]);

  /**
   * Generate recovery steps based on error type
   */
  const generateRecoverySteps = (error: CommunicationError): RecoveryStep[] => {
    const baseSteps: RecoveryStep[] = [];

    switch (error.type) {
      case 'connection_lost':
        baseSteps.push(
          {
            id: 'check_internet',
            label: 'Check Internet Connection',
            description: 'Verify that your device is connected to the internet',
            action: async () => {
              try {
                const response = await fetch('/api/health', { method: 'HEAD' });
                return response.ok;
              } catch {
                return false;
              }
            },
            completed: false,
            inProgress: false,
            optional: false,
          },
          {
            id: 'reconnect_socket',
            label: 'Reconnect Real-time Service',
            description: 'Re-establish connection to the messaging service',
            action: async () => {
              const { socketService } = await import(
                '../../services/socketService'
              );
              socketService.forceReconnect();
              await new Promise((resolve) => setTimeout(resolve, 2000));
              return socketService.isConnected();
            },
            completed: false,
            inProgress: false,
            optional: false,
          }
        );
        break;

      case 'message_send_failed':
        baseSteps.push(
          {
            id: 'retry_send',
            label: 'Retry Sending Message',
            description: 'Attempt to send the message again',
            action: async () => {
              if (onRetry) {
                await onRetry();
                return true;
              }
              return false;
            },
            completed: false,
            inProgress: false,
            optional: false,
          },
          {
            id: 'save_draft',
            label: 'Save as Draft',
            description: 'Save your message locally to prevent data loss',
            action: async () => {
              // Save to local storage or offline storage
              const { offlineStorage } = await import(
                '../../utils/offlineStorage'
              );
              await offlineStorage.saveFormDraft('message_draft', {
                content: error.details?.messageContent || '',
                timestamp: Date.now(),
              });
              return true;
            },
            completed: false,
            inProgress: false,
            optional: true,
          }
        );
        break;

      case 'file_upload_failed':
        baseSteps.push(
          {
            id: 'check_file_size',
            label: 'Check File Size',
            description: 'Verify that your file is within the size limit',
            action: async () => {
              const fileSize = error.details?.fileSize || 0;
              const maxSize = 10 * 1024 * 1024; // 10MB
              return fileSize <= maxSize;
            },
            completed: false,
            inProgress: false,
            optional: false,
          },
          {
            id: 'retry_upload',
            label: 'Retry File Upload',
            description: 'Attempt to upload the file again',
            action: async () => {
              if (onRetry) {
                await onRetry();
                return true;
              }
              return false;
            },
            completed: false,
            inProgress: false,
            optional: false,
          }
        );
        break;

      case 'authentication_expired':
        baseSteps.push({
          id: 'refresh_session',
          label: 'Refresh Session',
          description: 'Attempt to refresh your authentication session',
          action: async () => {
            try {
              const { authService } = await import(
                '../../services/authService'
              );
              return await authService.refreshToken();
            } catch {
              return false;
            }
          },
          completed: false,
          inProgress: false,
          optional: false,
        });
        break;

      case 'rate_limited':
        baseSteps.push({
          id: 'wait_cooldown',
          label: 'Wait for Rate Limit Reset',
          description: 'Wait for the rate limit to reset before trying again',
          action: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return true;
          },
          completed: false,
          inProgress: false,
          optional: false,
        });
        break;

      default:
        baseSteps.push({
          id: 'generic_retry',
          label: 'Retry Operation',
          description: 'Attempt the operation again',
          action: async () => {
            if (onRetry) {
              await onRetry();
              return true;
            }
            return false;
          },
          completed: false,
          inProgress: false,
          optional: false,
        });
    }

    // Add common recovery steps
    baseSteps.push(
      {
        id: 'clear_cache',
        label: 'Clear Browser Cache',
        description: 'Clear cached data that might be causing issues',
        action: async () => {
          try {
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map((name) => caches.delete(name)));
            }
            return true;
          } catch {
            return false;
          }
        },
        completed: false,
        inProgress: false,
        optional: true,
      },
      {
        id: 'refresh_page',
        label: 'Refresh Page',
        description: 'Reload the page to reset the application state',
        action: async () => {
          window.location.reload();
          return true;
        },
        completed: false,
        inProgress: false,
        optional: true,
      }
    );

    return baseSteps;
  };

  /**
   * Execute a recovery step
   */
  const executeStep = async (stepIndex: number): Promise<void> => {
    const step = recoverySteps[stepIndex];
    if (!step || step.completed) return;

    // Update step to in progress
    setRecoverySteps((prev) =>
      prev.map((s, i) => (i === stepIndex ? { ...s, inProgress: true } : s))
    );

    try {
      const success = await step.action();

      // Update step completion status
      setRecoverySteps((prev) =>
        prev.map((s, i) =>
          i === stepIndex ? { ...s, completed: success, inProgress: false } : s
        )
      );

      if (success && stepIndex === recoverySteps.length - 1) {
        // All steps completed successfully
        onRecover?.();
      }
    } catch (error) {
      console.error(`Recovery step ${step.id} failed:`, error);

      // Mark step as failed
      setRecoverySteps((prev) =>
        prev.map((s, i) => (i === stepIndex ? { ...s, inProgress: false } : s))
      );
    }
  };

  /**
   * Execute all recovery steps automatically
   */
  const executeAutoRecovery = async (): Promise<void> => {
    setAutoRecoveryInProgress(true);
    setRecoveryProgress(0);

    const nonOptionalSteps = recoverySteps.filter((step) => !step.optional);

    for (let i = 0; i < nonOptionalSteps.length; i++) {
      const stepIndex = recoverySteps.indexOf(nonOptionalSteps[i]);
      setActiveStep(stepIndex);

      await executeStep(stepIndex);

      setRecoveryProgress(((i + 1) / nonOptionalSteps.length) * 100);

      // Wait a bit between steps
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setAutoRecoveryInProgress(false);
  };

  /**
   * Get error severity icon and color
   */
  const getSeverityDisplay = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { icon: <ErrorIcon />, color: 'error' as const };
      case 'high':
        return { icon: <Warning />, color: 'warning' as const };
      case 'medium':
        return { icon: <Info />, color: 'info' as const };
      default:
        return { icon: <Info />, color: 'info' as const };
    }
  };

  if (!error) return null;

  const severityDisplay = getSeverityDisplay(error.severity);
  const completedSteps = recoverySteps.filter((step) => step.completed).length;
  const totalSteps = recoverySteps.filter((step) => !step.optional).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {severityDisplay.icon}
            <Typography variant="h6">Error Recovery Assistant</Typography>
          </Box>

          <Box
            sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Chip
              label={error.severity}
              color={severityDisplay.color}
              size="small"
            />
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Error Description */}
          <Alert severity={severityDisplay.color}>
            <Typography variant="subtitle2" gutterBottom>
              {error.userMessage}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Don't worry! We'll help you resolve this issue step by step.
            </Typography>
          </Alert>

          {/* Auto Recovery Progress */}
          {autoRecoveryInProgress && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Automatic recovery in progress...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={recoveryProgress}
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(recoveryProgress)}% complete
              </Typography>
            </Box>
          )}

          {/* Recovery Steps */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Recovery Steps ({completedSteps}/{totalSteps} completed)
            </Typography>

            <Stepper activeStep={activeStep} orientation="vertical">
              {recoverySteps.map((step, index) => (
                <Step key={step.id} completed={step.completed}>
                  <StepLabel
                    optional={
                      step.optional && (
                        <Typography variant="caption">Optional</Typography>
                      )
                    }
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: step.completed
                            ? 'success.main'
                            : step.inProgress
                            ? 'primary.main'
                            : 'grey.300',
                          color: 'white',
                        }}
                      >
                        {step.completed ? (
                          <CheckCircle sx={{ fontSize: 16 }} />
                        ) : step.inProgress ? (
                          <LinearProgress size={16} />
                        ) : (
                          <Typography variant="caption">{index + 1}</Typography>
                        )}
                      </Box>
                    )}
                  >
                    {step.label}
                  </StepLabel>

                  <StepContent>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {step.description}
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={step.inProgress ? <Stop /> : <PlayArrow />}
                        onClick={() => executeStep(index)}
                        disabled={
                          step.completed ||
                          step.inProgress ||
                          autoRecoveryInProgress
                        }
                      >
                        {step.inProgress
                          ? 'Running...'
                          : step.completed
                          ? 'Completed'
                          : 'Run Step'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>

          {/* Technical Details */}
          {showTechnicalDetails && (
            <Box>
              <Button
                onClick={() => setShowDetails(!showDetails)}
                endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                size="small"
              >
                Technical Details
              </Button>

              <Collapse in={showDetails}>
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Error Information:
                  </Typography>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(
                      {
                        type: error.type,
                        message: error.message,
                        code: error.code,
                        timestamp: new Date(error.timestamp).toISOString(),
                        context: error.context,
                      },
                      null,
                      2
                    )}
                  </Typography>
                </Alert>
              </Collapse>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={executeAutoRecovery}
          disabled={autoRecoveryInProgress || completedSteps === totalSteps}
        >
          {autoRecoveryInProgress ? 'Running...' : 'Auto Recovery'}
        </Button>

        {onRetry && (
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={onRetry}
            disabled={autoRecoveryInProgress}
          >
            Try Again
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ErrorRecoveryDialog;
