import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class MTRErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MTR Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BugReport color="error" sx={{ mr: 1 }} />
                <Typography variant="h6" color="error">
                  Something went wrong in the MTR module
                </Typography>
              </Box>
              
              <Alert severity="error" sx={{ mb: 2 }}>
                An unexpected error occurred while processing your MTR. 
                This has been logged for investigation.
              </Alert>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Error Details (Development Mode):
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    <Typography variant="body2" component="pre">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
            
            <CardActions sx={{ justifyContent: 'flex-end', gap: 1 }}>
              <Button onClick={this.handleReset} variant="outlined">
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                variant="contained"
                startIcon={<Refresh />}
              >
                Reload Page
              </Button>
            </CardActions>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default MTRErrorBoundary;