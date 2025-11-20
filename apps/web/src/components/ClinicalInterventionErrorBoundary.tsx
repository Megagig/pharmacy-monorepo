import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardActions,
  Collapse,
  IconButton,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugReportIcon,
  ContactSupport as ContactSupportIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import logger from '../utils/logger';

// Error types and interfaces
interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: string;
  errorInfo?: ErrorInfo;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  enableErrorReporting?: boolean;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  isolateErrors?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorDetails: ErrorDetails | null;
  retryCount: number;
  showDetails: boolean;
  showReportDialog: boolean;
  reportDescription: string;
  isReporting: boolean;
  reportSent: boolean;
}

// Error severity classification
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Recovery actions
enum RecoveryAction {
  RETRY = 'retry',
  REFRESH = 'refresh',
  CONTACT_SUPPORT = 'contact_support',
  RELOAD_PAGE = 'reload_page',
}

interface ErrorClassification {
  severity: ErrorSeverity;
  recoveryAction: RecoveryAction;
  userMessage: string;
  technicalMessage: string;
  recoveryInstructions: string[];
}

class ClinicalInterventionErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      retryCount: 0,
      showDetails: false,
      showReportDialog: false,
      reportDescription: '',
      isReporting: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      errorInfo,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    };

    this.setState({
      errorInfo,
      errorDetails,
    });

    // Log error
    this.logError(error, errorDetails);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry for certain error types
    if (
      this.shouldAutoRetry(error) &&
      this.state.retryCount < (this.props.maxRetries || 3)
    ) {
      this.scheduleRetry();
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when props change (if enabled)
    if (
      this.props.resetOnPropsChange &&
      this.state.hasError &&
      prevProps !== this.props
    ) {
      this.handleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private getUserId(): string | undefined {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id;
    } catch {
      return undefined;
    }
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined;
    } catch {
      return undefined;
    }
  }

  private logError(error: Error, details: ErrorDetails) {
    logger.error('Clinical Intervention Error Boundary caught error', {
      message: error.message,
      stack: error.stack,
      componentStack: details.componentStack,
      timestamp: details.timestamp,
      url: details.url,
      userId: details.userId,
      sessionId: details.sessionId,
      retryCount: this.state.retryCount,
    });
  }

  private classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        severity: ErrorSeverity.HIGH,
        recoveryAction: RecoveryAction.RETRY,
        userMessage:
          'Network connection issue. Please check your internet connection.',
        technicalMessage: error.message,
        recoveryInstructions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the issue persists',
        ],
      };
    }

    // Permission errors
    if (
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('403')
    ) {
      return {
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: RecoveryAction.REFRESH,
        userMessage: 'You do not have permission to perform this action.',
        technicalMessage: error.message,
        recoveryInstructions: [
          'Contact your administrator for access',
          'Try logging out and back in',
          'Refresh the page',
        ],
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        severity: ErrorSeverity.LOW,
        recoveryAction: RecoveryAction.RETRY,
        userMessage:
          'There was an issue with the data provided. Please check your input.',
        technicalMessage: error.message,
        recoveryInstructions: [
          'Check your input for errors',
          'Make sure all required fields are filled',
          'Try submitting again',
        ],
      };
    }

    // React component errors
    if (stack.includes('react') || message.includes('component')) {
      return {
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: RecoveryAction.REFRESH,
        userMessage: 'A component error occurred. Please refresh the page.',
        technicalMessage: error.message,
        recoveryInstructions: [
          'Refresh the page',
          'Clear your browser cache',
          'Contact support if the issue persists',
        ],
      };
    }

    // Default classification
    return {
      severity: ErrorSeverity.MEDIUM,
      recoveryAction: RecoveryAction.REFRESH,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      recoveryInstructions: [
        'Try the action again',
        'Refresh the page',
        'Contact support if the issue persists',
      ],
    };
  }

  private shouldAutoRetry(error: Error): boolean {
    const classification = this.classifyError(error);
    return (
      classification.recoveryAction === RecoveryAction.RETRY &&
      classification.severity !== ErrorSeverity.CRITICAL
    );
  }

  private scheduleRetry() {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s

    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  }

  private handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorDetails: null,
      retryCount: prevState.retryCount + 1,
      showDetails: false,
      showReportDialog: false,
      reportDescription: '',
      isReporting: false,
      reportSent: false,
    }));
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleToggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private handleShowReportDialog = () => {
    this.setState({ showReportDialog: true });
  };

  private handleCloseReportDialog = () => {
    this.setState({
      showReportDialog: false,
      reportDescription: '',
      isReporting: false,
      reportSent: false,
    });
  };

  private handleReportDescriptionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.setState({ reportDescription: event.target.value });
  };

  private handleSendReport = async () => {
    this.setState({ isReporting: true });

    try {
      // Simulate sending error report
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real implementation, you would send the error report to your backend
      const reportData = {
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        userDescription: this.state.reportDescription,
        timestamp: this.state.errorDetails?.timestamp,
        userId: this.state.errorDetails?.userId,
        url: this.state.errorDetails?.url,
        userAgent: this.state.errorDetails?.userAgent,
      };

      this.setState({
        isReporting: false,
        reportSent: true,
      });

      // Auto-close dialog after success
      setTimeout(() => {
        this.handleCloseReportDialog();
      }, 2000);
    } catch (reportError) {
      console.error('Failed to send error report:', reportError);
      this.setState({ isReporting: false });
    }
  };

  private getSeverityColor(
    severity: ErrorSeverity
  ): 'error' | 'warning' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  private getSeverityIcon(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return <ErrorIcon />;
      case ErrorSeverity.MEDIUM:
        return <WarningIcon />;
      case ErrorSeverity.LOW:
        return <InfoIcon />;
      default:
        return <ErrorIcon />;
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const error = this.state.error;
    const classification = error ? this.classifyError(error) : null;

    if (!error || !classification) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          <AlertTitle>Unknown Error</AlertTitle>
          An unknown error occurred. Please refresh the page.
        </Alert>
      );
    }

    return (
      <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
        <Card elevation={3}>
          <CardContent>
            <Stack spacing={2}>
              {/* Error Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {this.getSeverityIcon(classification.severity)}
                <Typography variant="h6" color="error">
                  Clinical Interventions Error
                </Typography>
                <Chip
                  label={classification.severity.toUpperCase()}
                  color={this.getSeverityColor(classification.severity)}
                  size="small"
                />
              </Box>

              {/* User Message */}
              <Alert severity={this.getSeverityColor(classification.severity)}>
                <AlertTitle>What happened?</AlertTitle>
                {classification.userMessage}
              </Alert>

              {/* Recovery Instructions */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  What you can do:
                </Typography>
                <List dense>
                  {classification.recoveryInstructions.map(
                    (instruction, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircleIcon color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={instruction} />
                      </ListItem>
                    )
                  )}
                </List>
              </Box>

              {/* Error Details (Collapsible) */}
              {this.props.showErrorDetails && (
                <Box>
                  <Button
                    startIcon={
                      this.state.showDetails ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )
                    }
                    onClick={this.handleToggleDetails}
                    size="small"
                  >
                    {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
                  </Button>

                  <Collapse in={this.state.showDetails}>
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
                        <strong>Error:</strong> {error.message}
                        {error.stack && (
                          <>
                            {'\n\n'}
                            <strong>Stack Trace:</strong>
                            {'\n'}
                            {error.stack}
                          </>
                        )}
                        {this.state.errorInfo?.componentStack && (
                          <>
                            {'\n\n'}
                            <strong>Component Stack:</strong>
                            {'\n'}
                            {this.state.errorInfo.componentStack}
                          </>
                        )}
                        {this.state.errorDetails && (
                          <>
                            {'\n\n'}
                            <strong>Timestamp:</strong>{' '}
                            {this.state.errorDetails.timestamp.toISOString()}
                            {'\n'}
                            <strong>URL:</strong> {this.state.errorDetails.url}
                            {this.state.errorDetails.userId && (
                              <>
                                {'\n'}
                                <strong>User ID:</strong>{' '}
                                {this.state.errorDetails.userId}
                              </>
                            )}
                          </>
                        )}
                      </Typography>
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Stack>
          </CardContent>

          <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= (this.props.maxRetries || 3)}
              >
                Try Again
              </Button>

              <Button variant="outlined" onClick={this.handleRefresh}>
                Refresh Page
              </Button>
            </Stack>

            {this.props.enableErrorReporting && (
              <Button
                startIcon={<BugReportIcon />}
                onClick={this.handleShowReportDialog}
                size="small"
              >
                Report Issue
              </Button>
            )}
          </CardActions>
        </Card>

        {/* Error Report Dialog */}
        <ErrorReportDialog
          open={this.state.showReportDialog}
          onClose={this.handleCloseReportDialog}
          onSend={this.handleSendReport}
          description={this.state.reportDescription}
          onDescriptionChange={this.handleReportDescriptionChange}
          isReporting={this.state.isReporting}
          reportSent={this.state.reportSent}
        />
      </Box>
    );
  }
}

// Error Report Dialog Component
interface ErrorReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  description: string;
  onDescriptionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isReporting: boolean;
  reportSent: boolean;
}

const ErrorReportDialog: React.FC<ErrorReportDialogProps> = ({
  open,
  onClose,
  onSend,
  description,
  onDescriptionChange,
  isReporting,
  reportSent,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon />
          Report Error
        </Box>
      </DialogTitle>

      <DialogContent>
        {reportSent ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            <AlertTitle>Report Sent Successfully</AlertTitle>
            Thank you for reporting this issue. Our team will investigate and
            work on a fix.
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Help us improve by describing what you were doing when this error
              occurred. Technical details will be included automatically.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Describe what happened"
              placeholder="I was trying to create a new intervention when..."
              value={description}
              onChange={onDescriptionChange}
              disabled={isReporting}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{reportSent ? 'Close' : 'Cancel'}</Button>

        {!reportSent && (
          <Button
            variant="contained"
            startIcon={
              isReporting ? <CircularProgress size={16} /> : <SendIcon />
            }
            onClick={onSend}
            disabled={isReporting || !description.trim()}
          >
            {isReporting ? 'Sending...' : 'Send Report'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// Higher-order component for wrapping components with error boundary
export const withClinicalInterventionErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) => {
  const WrappedComponent = (props: P) => (
    <ClinicalInterventionErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ClinicalInterventionErrorBoundary>
  );

  WrappedComponent.displayName = `withClinicalInterventionErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
};

export default ClinicalInterventionErrorBoundary;
