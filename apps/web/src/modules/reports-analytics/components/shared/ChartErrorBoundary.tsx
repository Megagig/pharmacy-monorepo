// Chart Error Boundary Component
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Paper, Typography, Alert, Button } from '@mui/material';
import {
  Refresh as RefreshIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to monitoring service
    console.error('Chart Error Boundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Paper
          sx={{
            p: 3,
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #ef444415, #f9731608)',
            border: '1px solid #ef444430',
          }}
        >
          <Alert
            severity="error"
            sx={{
              width: '100%',
              maxWidth: 500,
              backgroundColor: 'transparent',
              border: 'none',
              '& .MuiAlert-icon': {
                fontSize: 32,
              },
            }}
            icon={<BugIcon />}
          >
            <Typography variant="h6" gutterBottom color="error.main">
              Chart Rendering Error
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Something went wrong while rendering this chart. This is likely a
              temporary issue.
            </Typography>

            {/* Error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  maxHeight: 150,
                  overflow: 'auto',
                }}
              >
                <Typography variant="caption" color="error.main">
                  <strong>Error:</strong> {this.state.error.message}
                </Typography>
                {this.state.errorInfo && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="pre"
                    sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Typography>
                )}
              </Box>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                color="error"
              >
                Try Again
              </Button>
            </Box>
          </Alert>

          {/* Accessibility message */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 2,
              fontStyle: 'italic',
              textAlign: 'center',
            }}
            role="status"
            aria-live="polite"
          >
            Chart could not be rendered due to an error. Please try again or
            contact support.
          </Typography>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
