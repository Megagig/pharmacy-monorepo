import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Fab,
  Badge,
  useTheme,
  useMediaQuery,
  Snackbar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Replay as ReplayIcon,
  Cancel as CancelIcon,
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  NetworkCheck as NetworkCheckIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  CloudOff as CloudOffIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { AppError } from '../services/errorHandlingService';
import { useRetry } from '../utils/retryMechanism';
import { useErrorReporting } from '../services/errorReportingService';

// Props interfaces
interface ErrorRecoverySystemProps {
  errors: AppError[];
  onRetry?: (errorId: string) => Promise<void>;
  onDismiss?: (errorId: string) => void;
  onClearAll?: () => void;
  showNetworkStatus?: boolean;
  showRetryProgress?: boolean;
  maxVisibleErrors?: number;
}

interface ErrorRecoveryCardProps {
  error: AppError;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

interface NetworkStatusProps {
  showDetails?: boolean;
}

interface RetryProgressProps {
  activeRetries: string[];
  onCancel?: (operationId: string) => void;
}

// Network status component
const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showDetails = true,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get connection type if available
    const nav = navigator as any;
    if (nav.connection) {
      setConnectionType(nav.connection.effectiveType || 'unknown');

      nav.connection.addEventListener('change', () => {
        setConnectionType(nav.connection.effectiveType || 'unknown');
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOffIcon color="error" />;
    if (connectionType === 'slow-2g' || connectionType === '2g')
      return <CloudOffIcon color="warning" />;
    return <WifiIcon color="success" />;
  };

  const getConnectionText = () => {
    if (!isOnline) return 'Offline';
    if (connectionType === 'slow-2g') return 'Very Slow Connection';
    if (connectionType === '2g') return 'Slow Connection';
    if (connectionType === '3g') return 'Moderate Connection';
    if (connectionType === '4g') return 'Fast Connection';
    return 'Online';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {getConnectionIcon()}
      <Typography variant="body2" color={isOnline ? 'text.primary' : 'error'}>
        {getConnectionText()}
      </Typography>
      {showDetails && !isOnline && lastOnlineTime && (
        <Typography variant="caption" color="text.secondary">
          Last online: {lastOnlineTime.toLocaleTimeString()}
        </Typography>
      )}
    </Box>
  );
};

// Retry progress component
const RetryProgress: React.FC<RetryProgressProps> = ({
  activeRetries,
  onCancel,
}) => {
  if (activeRetries.length === 0) return null;

  return (
    <Card sx={{ mb: 2, bgcolor: 'info.50' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ReplayIcon color="info" />
          <Typography variant="subtitle2">
            Retrying Operations ({activeRetries.length})
          </Typography>
        </Box>

        <Stack spacing={1}>
          {activeRetries.map((operationId) => (
            <Box
              key={operationId}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <LinearProgress sx={{ flex: 1, height: 6, borderRadius: 3 }} />
              <Typography variant="caption" sx={{ minWidth: 100 }}>
                {operationId}
              </Typography>
              {onCancel && (
                <IconButton size="small" onClick={() => onCancel(operationId)}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

// Individual error recovery card
const ErrorRecoveryCard: React.FC<ErrorRecoveryCardProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  compact = false,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(showDetails);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const { submitErrorReport } = useErrorReporting();

  const getSeverityColor = () => {
    switch (error.severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  const getSeverityIcon = () => {
    switch (error.severity) {
      case 'critical':
      case 'high':
        return <ErrorIcon />;
      case 'medium':
        return <WarningIcon />;
      case 'low':
        return <InfoIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleReportError = async () => {
    try {
      await submitErrorReport(
        error,
        {
          component: 'ErrorRecoveryCard',
          action: 'manual_report',
        },
        reportDescription
      );

      setShowReportDialog(false);
      setReportDescription('');
    } catch (reportError) {
      console.error('Failed to submit error report:', reportError);
    }
  };

  const getRecoveryInstructions = (): string[] => {
    switch (error.recoveryAction) {
      case 'retry':
        return [
          'Wait a moment and try again',
          'Check your internet connection',
          'If the problem persists, contact support',
        ];
      case 'refresh':
        return [
          'Refresh the page and try again',
          'Clear your browser cache',
          'Make sure you have the latest version',
        ];
      case 'validate_input':
        return [
          'Check your input for errors',
          'Make sure all required fields are filled',
          'Verify the data format is correct',
        ];
      case 'check_permissions':
        return [
          'Contact your administrator for access',
          'Make sure you have the required permissions',
          'Try logging out and back in',
        ];
      case 'check_network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact IT support if issues persist',
        ];
      default:
        return [
          'Try the action again',
          'Contact support if the problem persists',
        ];
    }
  };

  if (compact) {
    return (
      <Alert
        severity={getSeverityColor() as any}
        sx={{ mb: 1 }}
        action={
          <Stack direction="row" spacing={1}>
            {onRetry && (
              <Button
                size="small"
                onClick={handleRetry}
                disabled={isRetrying}
                startIcon={
                  isRetrying ? (
                    <LinearProgress sx={{ width: 16, height: 2 }} />
                  ) : (
                    <RefreshIcon />
                  )
                }
              >
                Retry
              </Button>
            )}
            {onDismiss && (
              <IconButton size="small" onClick={onDismiss}>
                <CancelIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        }
      >
        <AlertTitle>{error.type.replace(/_/g, ' ')}</AlertTitle>
        {error.message}
      </Alert>
    );
  }

  return (
    <>
      <Card sx={{ mb: 2, border: `1px solid ${getSeverityColor()}` }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}
          >
            {getSeverityIcon()}
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {error.type.replace(/_/g, ' ')}
                <Chip
                  label={error.severity.toUpperCase()}
                  size="small"
                  color={getSeverityColor() as any}
                />
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {new Date(error.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {error.message}
              </Typography>

              {/* Recovery Instructions */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Recovery Steps:
                </Typography>
                <List dense>
                  {getRecoveryInstructions().map((instruction, index) => (
                    <ListItem key={index} sx={{ py: 0.25, pl: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckCircleIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={instruction}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Error Details */}
              <Box>
                <Button
                  size="small"
                  startIcon={
                    showErrorDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />
                  }
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                >
                  {showErrorDetails ? 'Hide' : 'Show'} Technical Details
                </Button>

                <Collapse in={showErrorDetails}>
                  <Box
                    sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      <strong>Error Type:</strong> {error.type}
                      {'\n'}
                      <strong>Severity:</strong> {error.severity}
                      {'\n'}
                      <strong>Recovery Action:</strong> {error.recoveryAction}
                      {'\n'}
                      <strong>Timestamp:</strong> {error.timestamp}
                      {error.details &&
                        Object.keys(error.details).length > 0 && (
                          <>
                            {'\n\n'}
                            <strong>Details:</strong>
                            {'\n'}
                            {JSON.stringify(error.details, null, 2)}
                          </>
                        )}
                      {error.technicalMessage && (
                        <>
                          {'\n\n'}
                          <strong>Technical Message:</strong>
                          {'\n'}
                          {error.technicalMessage}
                        </>
                      )}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Box>
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1}>
            {onRetry && (
              <Button
                variant="contained"
                startIcon={
                  isRetrying ? (
                    <LinearProgress sx={{ width: 16, height: 2 }} />
                  ) : (
                    <RefreshIcon />
                  )
                }
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
            )}

            <Button variant="outlined" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<BugReportIcon />}
              onClick={() => setShowReportDialog(true)}
              size="small"
            >
              Report
            </Button>

            {onDismiss && (
              <Button onClick={onDismiss} size="small">
                Dismiss
              </Button>
            )}
          </Stack>
        </CardActions>
      </Card>

      {/* Error Report Dialog */}
      <Dialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Report Error</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Help us improve by describing what you were doing when this error
            occurred.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Describe what happened"
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="I was trying to..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReportDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleReportError}
            disabled={!reportDescription.trim()}
          >
            Send Report
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Main error recovery system component
const ErrorRecoverySystem: React.FC<ErrorRecoverySystemProps> = ({
  errors,
  onRetry,
  onDismiss,
  onClearAll,
  showNetworkStatus = true,
  showRetryProgress = true,
  maxVisibleErrors = 5,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { activeRetries, cancelRetry } = useRetry();
  const { hasPendingReports, pendingReportsCount } = useErrorReporting();

  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showSystemPanel, setShowSystemPanel] = useState(false);

  const visibleErrors = showAllErrors
    ? errors
    : errors.slice(0, maxVisibleErrors);
  const hasMoreErrors = errors.length > maxVisibleErrors;

  if (errors.length === 0 && activeRetries.length === 0 && !hasPendingReports) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Network Status */}
      {showNetworkStatus && (
        <Box
          sx={{
            mb: 2,
            p: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <NetworkStatus showDetails={!isMobile} />
        </Box>
      )}

      {/* Retry Progress */}
      {showRetryProgress && (
        <RetryProgress activeRetries={activeRetries} onCancel={cancelRetry} />
      )}

      {/* Error List */}
      {errors.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h6">
              Active Errors ({errors.length})
            </Typography>
            {onClearAll && (
              <Button size="small" onClick={onClearAll}>
                Clear All
              </Button>
            )}
          </Box>

          {visibleErrors.map((error, index) => (
            <ErrorRecoveryCard
              key={`${error.type}-${error.timestamp}-${index}`}
              error={error}
              onRetry={onRetry ? () => onRetry(error.type) : undefined}
              onDismiss={onDismiss ? () => onDismiss(error.type) : undefined}
              compact={isMobile}
            />
          ))}

          {hasMoreErrors && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setShowAllErrors(!showAllErrors)}
              sx={{ mt: 1 }}
            >
              {showAllErrors
                ? 'Show Less'
                : `Show ${errors.length - maxVisibleErrors} More Errors`}
            </Button>
          )}
        </Box>
      )}

      {/* Floating Action Button for System Panel */}
      {(hasPendingReports || activeRetries.length > 0) && (
        <Fab
          color="primary"
          size="small"
          sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
          onClick={() => setShowSystemPanel(true)}
        >
          <Badge
            badgeContent={pendingReportsCount + activeRetries.length}
            color="error"
          >
            <NetworkCheckIcon />
          </Badge>
        </Fab>
      )}

      {/* System Panel Dialog */}
      <Dialog
        open={showSystemPanel}
        onClose={() => setShowSystemPanel(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>System Status</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <NetworkStatus showDetails={true} />

            {activeRetries.length > 0 && (
              <RetryProgress
                activeRetries={activeRetries}
                onCancel={cancelRetry}
              />
            )}

            {hasPendingReports && (
              <Alert severity="info">
                <AlertTitle>Pending Error Reports</AlertTitle>
                {pendingReportsCount} error report
                {pendingReportsCount !== 1 ? 's' : ''} waiting to be sent. They
                will be automatically sent when connection is restored.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSystemPanel(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ErrorRecoverySystem;
export { NetworkStatus, RetryProgress, ErrorRecoveryCard };
