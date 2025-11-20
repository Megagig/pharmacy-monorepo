import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Alert,
  Button,
  Box,
  Typography,
  Stack,
  Paper,
  Divider,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh,
  BugReport,
  ExpandMore,
  ExpandLess,
  Wifi,
  WifiOff,
} from '@mui/icons-material';
import { retryMechanism } from '../../utils/retryMechanism';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { socketService } from '../../services/socketService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string; // e.g., 'chat-interface', 'message-thread', 'conversation-list'
  enableRetry?: boolean;
  enableOfflineMode?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
  showDetails: boolean;
  isOffline: boolean;
  lastErrorTime: number;
}

/**
 * Communication-specific Error Boundary with advanced recovery features
 * Handles real-time messaging errors, offline scenarios, and provides contextual recovery options
 */
class CommunicationErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];
  private offlineCheckInterval?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0,
      showDetails: false,
      isOffline: !navigator.onLine,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `comm_error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { context = 'unknown', onError } = this.props;

    // Log error with performance monitoring
    performanceMonitor.recordMetric('communication_error', 1, {
      context,
      errorType: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack?.split('\n')[1] || 'unknown',
    });

    console.error(`Communication Error in ${context}:`, error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Report error to error tracking service
    this.reportError(error, errorInfo, context);
  }

  componentDidMount() {
    // Monitor online/offline status
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Check connection status periodically
    this.offlineCheckInterval = setInterval(this.checkConnectionStatus, 5000);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    // Clear timeouts
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));

    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
    }
  }

  private handleOnline = () => {
    this.setState({ isOffline: false });

    // If we had an error and are now online, suggest retry
    if (this.state.hasError && this.isNetworkError(this.state.error)) {
      this.showRecoveryMessage(
        'Connection restored. You can now retry the operation.'
      );
    }
  };

  private handleOffline = () => {
    this.setState({ isOffline: true });
  };

  private checkConnectionStatus = () => {
    const isSocketConnected = socketService.isConnected();
    const isOnline = navigator.onLine;

    this.setState((prevState) => ({
      isOffline: !isOnline || !isSocketConnected,
    }));
  };

  private isNetworkError = (error?: Error): boolean => {
    if (!error) return false;

    const networkErrorPatterns = [
      'network error',
      'fetch',
      'connection',
      'timeout',
      'socket',
      'websocket',
      'offline',
    ];

    return networkErrorPatterns.some(
      (pattern) =>
        error.message.toLowerCase().includes(pattern) ||
        error.name.toLowerCase().includes(pattern)
    );
  };

  private isRecoverableError = (error?: Error): boolean => {
    if (!error) return false;

    // Network errors are usually recoverable
    if (this.isNetworkError(error)) return true;

    // Component errors might be recoverable with retry
    const recoverablePatterns = [
      'chunkloaderror',
      'loading chunk',
      'dynamically imported module',
      'script error',
    ];

    return recoverablePatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern)
    );
  };

  private getErrorSeverity = (
    error?: Error
  ): 'low' | 'medium' | 'high' | 'critical' => {
    if (!error) return 'medium';

    // Network errors are usually low severity
    if (this.isNetworkError(error)) return 'low';

    // Security or authentication errors are high severity
    if (
      error.message.includes('auth') ||
      error.message.includes('permission')
    ) {
      return 'high';
    }

    // Data corruption or critical component failures
    if (error.message.includes('corrupt') || error.name === 'ChunkLoadError') {
      return 'critical';
    }

    return 'medium';
  };

  private getRecoveryActions = (
    error?: Error
  ): Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }> => {
    const actions = [];

    // Always allow retry for recoverable errors
    if (this.isRecoverableError(error) && this.props.enableRetry !== false) {
      actions.push({
        label: 'Try Again',
        action: this.handleRetry,
        primary: true,
      });
    }

    // Network-specific actions
    if (this.isNetworkError(error)) {
      actions.push({
        label: 'Check Connection',
        action: this.handleConnectionCheck,
      });

      if (this.props.enableOfflineMode) {
        actions.push({
          label: 'Continue Offline',
          action: this.handleOfflineMode,
        });
      }
    }

    // Chunk loading errors
    if (error?.name === 'ChunkLoadError') {
      actions.push({
        label: 'Reload Page',
        action: this.handlePageReload,
        primary: true,
      });
    }

    // Always allow error reporting
    actions.push({
      label: 'Report Issue',
      action: this.handleReportError,
    });

    return actions;
  };

  private handleRetry = async () => {
    const { context = 'communication' } = this.props;
    const retryCount = this.state.retryCount + 1;

    this.setState({ retryCount });

    try {
      // Use retry mechanism for automatic retry with backoff
      await retryMechanism.executeWithRetry(
        async () => {
          // Reset error state to trigger re-render
          this.setState({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
          });

          // Wait a bit to ensure component re-renders
          await new Promise((resolve) => setTimeout(resolve, 100));

          // If still in error state, throw to trigger retry
          if (this.state.hasError) {
            throw new Error('Component still in error state');
          }
        },
        `${context}_error_recovery_${this.state.errorId}`,
        {
          maxAttempts: 3,
          initialDelay: 1000 * retryCount, // Increase delay with each manual retry
          onRetry: (attempt) => {
          },
        }
      );
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      this.showRecoveryMessage('Retry failed. Please try refreshing the page.');
    }
  };

  private handleConnectionCheck = () => {
    // Force socket reconnection
    socketService.forceReconnect();

    // Check if we can reach the server
    fetch('/api/health', { method: 'HEAD' })
      .then(() => {
        this.showRecoveryMessage('Connection is working. You can retry now.');
      })
      .catch(() => {
        this.showRecoveryMessage(
          'Connection issue detected. Please check your internet connection.'
        );
      });
  };

  private handleOfflineMode = () => {
    this.setState({ hasError: false });
    this.showRecoveryMessage(
      'Switched to offline mode. Some features may be limited.'
    );
  };

  private handlePageReload = () => {
    window.location.reload();
  };

  private handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;
    const { context } = this.props;

    const errorReport = {
      errorId,
      context,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOffline: this.state.isOffline,
      socketConnected: socketService.isConnected(),
    };

    // In production, this would send to error tracking service

    // Copy to clipboard for easy sharing
    navigator.clipboard
      ?.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        this.showRecoveryMessage('Error report copied to clipboard.');
      })
      .catch(() => {
        this.showRecoveryMessage('Error report logged to console.');
      });
  };

  private showRecoveryMessage = (message: string) => {
    // This would integrate with your notification system

  };

  private reportError = (
    error: Error,
    errorInfo: ErrorInfo,
    context: string
  ) => {
    // Report to error tracking service (e.g., Sentry, LogRocket)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, isOffline, retryCount } =
        this.state;
      const { fallback, context = 'Communication' } = this.props;

      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      const severity = this.getErrorSeverity(error);
      const recoveryActions = this.getRecoveryActions(error);
      const isRecoverable = this.isRecoverableError(error);

      return (
        <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
          <Paper elevation={2} sx={{ p: 4 }}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              {/* Error Icon and Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ErrorIcon
                  color={severity === 'critical' ? 'error' : 'warning'}
                  sx={{ fontSize: 48 }}
                />
                {isOffline && (
                  <WifiOff color="disabled" sx={{ fontSize: 24 }} />
                )}
              </Box>

              {/* Error Title */}
              <Typography variant="h5" color="error" gutterBottom>
                {context} Error
              </Typography>

              {/* Error Description */}
              <Typography variant="body1" color="text.secondary">
                {this.isNetworkError(error)
                  ? 'Connection issue detected. Please check your internet connection and try again.'
                  : isRecoverable
                  ? 'A temporary error occurred. This can usually be resolved by trying again.'
                  : 'An unexpected error occurred while loading this component.'}
              </Typography>

              {/* Status Chips */}
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                justifyContent="center"
              >
                <Chip
                  label={`Severity: ${severity}`}
                  color={
                    severity === 'critical'
                      ? 'error'
                      : severity === 'high'
                      ? 'warning'
                      : 'default'
                  }
                  size="small"
                />
                {retryCount > 0 && (
                  <Chip label={`Retries: ${retryCount}`} size="small" />
                )}
                {isOffline && (
                  <Chip
                    icon={<WifiOff />}
                    label="Offline"
                    color="warning"
                    size="small"
                  />
                )}
              </Stack>

              {/* Recovery Actions */}
              {recoveryActions.length > 0 && (
                <Stack
                  direction="row"
                  spacing={2}
                  flexWrap="wrap"
                  justifyContent="center"
                >
                  {recoveryActions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.primary ? 'contained' : 'outlined'}
                      onClick={action.action}
                      startIcon={
                        action.label === 'Try Again' ? (
                          <Refresh />
                        ) : action.label === 'Report Issue' ? (
                          <BugReport />
                        ) : action.label === 'Check Connection' ? (
                          <Wifi />
                        ) : undefined
                      }
                    >
                      {action.label}
                    </Button>
                  ))}
                </Stack>
              )}

              {/* Error Details (Development) */}
              {process.env.NODE_ENV === 'development' && error && (
                <>
                  <Divider sx={{ width: '100%' }} />

                  <Box sx={{ width: '100%' }}>
                    <Button
                      onClick={this.toggleDetails}
                      endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                      size="small"
                    >
                      Error Details
                    </Button>

                    <Collapse in={showDetails}>
                      <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Error Message:
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            overflow: 'auto',
                            maxHeight: 200,
                            whiteSpace: 'pre-wrap',
                            mb: 2,
                          }}
                        >
                          {error.message}
                        </Typography>

                        {error.stack && (
                          <>
                            <Typography variant="subtitle2" gutterBottom>
                              Stack Trace:
                            </Typography>
                            <Typography
                              variant="body2"
                              component="pre"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                overflow: 'auto',
                                maxHeight: 300,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {error.stack}
                            </Typography>
                          </>
                        )}
                      </Alert>
                    </Collapse>
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default CommunicationErrorBoundary;
