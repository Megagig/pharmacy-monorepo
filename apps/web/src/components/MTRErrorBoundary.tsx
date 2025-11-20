import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

/**
 * MTR Error Boundary Component
 * Provides graceful error recovery for MTR module
 * Requirements: 2.4, 4.4, 7.1, 8.4
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

interface MTRErrorDetails {
  field?: string;
  message: string;
  value?: unknown;
  location?: string;
}

interface MTRError {
  type: string;
  message: string;
  details?: MTRErrorDetails[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recovery?: string[];
  timestamp?: string;
}

class MTRErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorId: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `mtr-error-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MTR ErrorBoundary caught an error:', error, errorInfo);

    // Log error for audit trail (Requirement 7.1)
    this.logMTRError(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logMTRError = (error: Error, errorInfo: ErrorInfo) => {
    const errorLog = {
      errorId: this.state.errorId,
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(), // Get from auth context if available
    };

    // Send to logging service only (no local storage for security)
    try {
      // Note: localStorage removed for security - errors are only logged to console in development
      console.error('MTR Error Log:', errorLog);

      // In production, send to error tracking service
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to error tracking service
        // errorTrackingService.logError(errorLog);
      }
    } catch (logError) {
      console.error('Failed to log MTR error:', logError);
    }
  };

  private getUserId = (): string | null => {
    // Note: Authentication moved to httpOnly cookies for security
    // User ID is not accessible from client-side storage
    try {
      // In production, this would be retrieved from the auth context/hook
      // For error logging, user ID can be omitted or retrieved from server
      return null; // User ID not available from local storage anymore
    } catch {
      // Ignore parsing errors
    }

    return null;
  };

  private parseMTRError = (error: Error): MTRError | null => {
    try {
      // Try to parse MTR-specific error format
      if (error.message.includes('MTR')) {
        // This would be enhanced to parse actual MTR error responses
        return {
          type: 'MTRError',
          message: error.message,
          severity: 'medium',
          recovery: [
            'Check your input data',
            'Verify required fields are completed',
            'Try refreshing the page',
          ],
        };
      }
    } catch {
      // Ignore parsing errors
    }

    return null;
  };

  private getErrorSeverity = (
    error: Error
  ): 'low' | 'medium' | 'high' | 'critical' => {
    const mtrError = this.parseMTRError(error);
    if (mtrError?.severity) {
      return mtrError.severity;
    }

    // Determine severity based on error type
    if (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk')
    ) {
      return 'low';
    }

    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'high';
    }

    return 'medium';
  };

  private getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'warning';
    }
  };

  private getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon />;
      case 'high':
        return <ErrorIcon />;
      case 'medium':
        return <WarningIcon />;
      case 'low':
        return <InfoIcon />;
      default:
        return <WarningIcon />;
    }
  };

  private getRecoveryActions = (error: Error): string[] => {
    const mtrError = this.parseMTRError(error);
    if (mtrError?.recovery) {
      return mtrError.recovery;
    }

    // Default recovery actions based on error type
    if (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk')
    ) {
      return [
        'Refresh the page to reload the application',
        'Clear your browser cache',
        'Check your internet connection',
      ];
    }

    if (error.message.includes('Network')) {
      return [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if the issue persists',
      ];
    }

    return [
      'Try refreshing the page',
      'Go back to the previous step',
      'Contact support if the problem continues',
    ];
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    });
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private handleReportError = () => {
    const errorData = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Create mailto link for error reporting
    const subject = encodeURIComponent(
      `MTR Error Report - ${this.state.errorId}`
    );
    const body = encodeURIComponent(`
Error ID: ${errorData.errorId}
Message: ${errorData.message}
Timestamp: ${errorData.timestamp}
URL: ${errorData.url}

Please describe what you were doing when this error occurred:
[Your description here]
    `);

    window.open(
      `mailto:support@PharmacyCopilot.com?subject=${subject}&body=${body}`
    );
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error!;
      const severity = this.getErrorSeverity(error);
      const recoveryActions = this.getRecoveryActions(error);
      const mtrError = this.parseMTRError(error);

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            p: 3,
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 800,
              width: '100%',
            }}
          >
            <Alert
              severity={
                this.getSeverityColor(severity) as
                  | 'error'
                  | 'warning'
                  | 'info'
                  | 'success'
              }
              icon={this.getSeverityIcon(severity)}
              sx={{ mb: 3 }}
            >
              <AlertTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  MTR Module Error
                  <Chip
                    label={severity.toUpperCase()}
                    size="small"
                    color={
                      this.getSeverityColor(severity) as
                        | 'default'
                        | 'primary'
                        | 'secondary'
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warning'
                    }
                    variant="outlined"
                  />
                </Box>
              </AlertTitle>
              <Typography variant="body2" sx={{ mt: 1 }}>
                An error occurred in the Medication Therapy Review module.
                {severity === 'low' && ' This is likely a temporary issue.'}
                {severity === 'medium' &&
                  ' Please try the suggested recovery actions.'}
                {severity === 'high' && ' This requires immediate attention.'}
                {severity === 'critical' &&
                  ' This is a critical error that needs urgent resolution.'}
              </Typography>
            </Alert>

            {/* Error Message */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Error Details
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="error">
                  {error.message}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  Error ID: {this.state.errorId}
                </Typography>
              </Paper>
            </Box>

            {/* Recovery Actions */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <LightbulbIcon color="primary" />
                Suggested Actions
              </Typography>
              <List dense>
                {recoveryActions.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Typography
                        variant="body2"
                        color="primary"
                        fontWeight="bold"
                      >
                        {index + 1}.
                      </Typography>
                    </ListItemIcon>
                    <ListItemText primary={action} />
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* MTR Error Details */}
            {mtrError?.details && (
              <Accordion sx={{ mb: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    MTR Validation Details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {mtrError.details.map((detail, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={detail.message}
                          secondary={detail.field && `Field: ${detail.field}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Technical Details (Development only) */}
            {(import.meta.env.DEV || this.props.showDetails) &&
              this.state.error && (
                <Accordion sx={{ mb: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Technical Details
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', overflow: 'auto' }}>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
                      >
                        {this.state.error.stack}
                        {this.state.errorInfo?.componentStack}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}

            <Divider sx={{ my: 3 }} />

            {/* Action Buttons */}
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="contained"
                onClick={this.handleReset}
                startIcon={<RefreshIcon />}
              >
                Try Again
              </Button>

              <Button
                variant="outlined"
                onClick={this.handleReload}
                startIcon={<RefreshIcon />}
              >
                Reload Page
              </Button>

              <Button
                variant="outlined"
                onClick={this.handleGoHome}
                startIcon={<HomeIcon />}
              >
                Go to Dashboard
              </Button>

              <Button
                variant="text"
                onClick={this.handleReportError}
                startIcon={<BugReportIcon />}
                size="small"
              >
                Report Error
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default MTRErrorBoundary;

// Higher-order component for wrapping MTR components
export const withMTRErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<Props>
) => {
  const WrappedComponent = (props: P) => (
    <MTRErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </MTRErrorBoundary>
  );

  WrappedComponent.displayName = `withMTRErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
};
