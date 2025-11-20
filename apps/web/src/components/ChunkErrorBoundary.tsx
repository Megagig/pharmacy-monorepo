import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    isChunkError: boolean;
    error: Error | null;
}

class ChunkErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            isChunkError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Check if it's a chunk loading error
        const isChunkError =
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed') ||
            error.message.includes('error loading dynamically imported module') ||
            error.name === 'ChunkLoadError';

        return {
            hasError: true,
            isChunkError,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Chunk loading error:', error, errorInfo);

        // For chunk errors, let the LazyWrapper handle retries first
        // Only auto-reload after a delay to give retry mechanisms a chance
        if (this.state.isChunkError) {
            // Only auto-reload after 10 seconds to give retry mechanisms time
            setTimeout(() => {
                if (this.state.hasError) {
                    console.warn('Chunk error persisted, reloading page...');
                    window.location.reload();
                }
            }, 10000);
        }
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.state.isChunkError) {
                return (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '100vh',
                            bgcolor: 'background.default',
                            p: 3,
                        }}
                    >
                        <Paper
                            elevation={3}
                            sx={{
                                p: 4,
                                maxWidth: 500,
                                textAlign: 'center',
                            }}
                        >
                            <Alert severity="info" sx={{ mb: 3 }}>
                                New version detected! Updating...
                            </Alert>
                            <Typography variant="h5" gutterBottom>
                                Updating Application
                            </Typography>
                            <Typography variant="body1" color="text.secondary" paragraph>
                                A new version of the application has been deployed. The page will
                                automatically reload in a moment.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                If the page doesn't reload automatically, please click the button below.
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<RefreshIcon />}
                                onClick={this.handleReload}
                                sx={{ mt: 2 }}
                            >
                                Reload Now
                            </Button>
                        </Paper>
                    </Box>
                );
            }

            // For other errors, show a generic error message
            return (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '100vh',
                        bgcolor: 'background.default',
                        p: 3,
                    }}
                >
                    <Paper
                        elevation={3}
                        sx={{
                            p: 4,
                            maxWidth: 500,
                            textAlign: 'center',
                        }}
                    >
                        <Alert severity="error" sx={{ mb: 3 }}>
                            Something went wrong
                        </Alert>
                        <Typography variant="h5" gutterBottom>
                            Oops! An Error Occurred
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<RefreshIcon />}
                            onClick={this.handleReload}
                            sx={{ mt: 2 }}
                        >
                            Reload Page
                        </Button>
                    </Paper>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ChunkErrorBoundary;
