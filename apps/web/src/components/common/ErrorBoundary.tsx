import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  BugReport,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Stack spacing={3} alignItems="center">
                <ErrorOutline sx={{ fontSize: 64, color: 'error.main' }} />
                
                <Box textAlign="center">
                  <Typography variant="h5" gutterBottom>
                    Something went wrong
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    We encountered an unexpected error. This has been logged and our team will investigate.
                  </Typography>
                </Box>

                {this.state.error && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    <Typography variant="body2" component="div">
                      <strong>Error:</strong> {this.state.error.message}
                    </Typography>
                    {process.env.NODE_ENV === 'development' && (
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          icon={<BugReport />}
                          label="Development Mode"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                        <Typography
                          variant="caption"
                          component="pre"
                          sx={{
                            mt: 1,
                            p: 1,
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            overflow: 'auto',
                            maxHeight: 200,
                          }}
                        >
                          {this.state.error.stack}
                        </Typography>
                      </Box>
                    )}
                  </Alert>
                )}

                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={this.handleRetry}
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={this.handleReload}
                  >
                    Reload Page
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export default ErrorBoundary;