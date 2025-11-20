import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Alert, Button, Typography } from '@mui/material';
import ModernDashboard from '../components/dashboard/ModernDashboard';

// Error fallback component for dashboard-specific errors
const DashboardErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <Box sx={{ p: 3, textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Alert severity="error" sx={{ maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        Dashboard Loading Error
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {error.message.includes('useContext') || error.message.includes('dispatcher is null')
          ? 'There was a temporary issue loading the dashboard. This usually resolves automatically.'
          : error.message || 'An unexpected error occurred while loading the dashboard.'}
      </Typography>
      <Button
        variant="contained"
        onClick={resetErrorBoundary}
        size="small"
      >
        Reload Dashboard
      </Button>
    </Alert>
  </Box>
);

const ModernDashboardPage: React.FC = () => {
  // Add a small delay to ensure all React contexts are fully initialized
  // This prevents "dispatcher is null" errors with lazy-loaded components
  const [isContextReady, setIsContextReady] = React.useState(false);

  React.useEffect(() => {
    // Use a microtask to ensure React's context providers are ready
    Promise.resolve().then(() => {
      setIsContextReady(true);
    });
  }, []);

  if (!isContextReady) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              border: '3px solid #1976d2',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              mx: 'auto',
              mb: 2,
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          <Typography variant="body2" sx={{ color: '#666' }}>
            Initializing Dashboard...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={DashboardErrorFallback}
      onReset={() => {
        // Force a clean reload to reset all contexts
        window.location.reload();
      }}
      onError={(error) => {
        console.error('Dashboard error:', error);
        // Log specific hook errors for debugging
        if (error.message.includes('useContext') || error.message.includes('dispatcher is null')) {
          console.warn('React context/hooks error detected - this is usually temporary');
        }
      }}
    >
      <ModernDashboard />
    </ErrorBoundary>
  );
};

export default ModernDashboardPage;
