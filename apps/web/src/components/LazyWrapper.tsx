import React, { Suspense, ComponentType } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Alert, Button, Typography, CircularProgress } from '@mui/material';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { 
  isChunkLoadError, 
  handlePersistentChunkError, 
  checkForNewVersion,
  preloadComponentSafely 
} from '../utils/chunkLoadingUtils';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ComponentType;
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
}

// Enhanced error fallback component with chunk error handling
const DefaultErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [checkingVersion, setCheckingVersion] = React.useState(false);
  
  const isChunkError = isChunkLoadError(error);
  
  // Enhanced logging for debugging
  console.error(`[LazyWrapper] Error caught:`, {
    message: error.message,
    name: error.name,
    stack: error.stack,
    isChunkError,
    retryCount
  });
  
  const handleRetry = async () => {
    setIsRetrying(true);
    
    try {
      // Check if there's a new version deployed
      setCheckingVersion(true);
      const hasNewVersion = await checkForNewVersion();
      setCheckingVersion(false);
      
      if (hasNewVersion || retryCount >= 2) {
        // If new version detected or multiple retries, clear cache and reload
        handlePersistentChunkError();
        return;
      }
      
      // Simple retry
      setRetryCount(prev => prev + 1);
      setTimeout(() => {
        resetErrorBoundary();
        setIsRetrying(false);
      }, 1000);
    } catch (retryError) {
      console.error('Error during retry:', retryError);
      setIsRetrying(false);
      setCheckingVersion(false);
      resetErrorBoundary();
    }
  };
  
  if (isChunkError) {
    const isDev = import.meta.env.DEV;
    
    return (
      <Box sx={{ p: 3, textAlign: 'center', maxWidth: 500, mx: 'auto' }}>
        <Alert 
          severity={retryCount === 0 ? "info" : "warning"} 
          sx={{ mb: 2 }}
          icon={(typeof navigator !== 'undefined' && navigator.onLine) ? <Wifi size={20} /> : <WifiOff size={20} />}
        >
          <Typography variant="h6" gutterBottom>
            {retryCount === 0 ? 'Loading Component' : 'Component Load Failed'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isDev ? (
              retryCount === 0 
                ? 'Loading component in development mode...' 
                : `Failed to load component (attempt ${retryCount + 1}). This can happen during development when Vite's HMR is reloading modules.`
            ) : (
              retryCount === 0 
                ? 'Please wait while we load the latest version...' 
                : `Failed to load component (attempt ${retryCount + 1}). This might be due to a new app version being deployed.`
            )}
          </Typography>
          {isDev && retryCount > 0 && (
            <Typography variant="body2" color="info.main" sx={{ mb: 2 }}>
              Development mode: Try refreshing the page or restarting the dev server.
            </Typography>
          )}
          {(typeof navigator !== 'undefined' && !navigator.onLine) && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              Network connection lost. Please check your internet connection.
            </Typography>
          )}
        </Alert>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={isRetrying || checkingVersion ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
            onClick={handleRetry}
            disabled={isRetrying || checkingVersion}
            size="small"
          >
            {checkingVersion ? 'Checking...' : isRetrying ? 'Retrying...' : 'Try Again'}
          </Button>
          
          {retryCount > 0 && (
            <Button
              variant="outlined"
              onClick={() => handlePersistentChunkError()}
              size="small"
            >
              Force Reload
            </Button>
          )}
        </Box>
        
        {retryCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            If this persists, try refreshing the page or clearing your browser cache.
          </Typography>
        )}
      </Box>
    );
  }
  
  // For non-chunk errors, show the original simple error
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Failed to load component
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error.message || 'An unexpected error occurred while loading this page.'}
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshCw size={16} />}
          onClick={resetErrorBoundary}
          size="small"
        >
          Try Again
        </Button>
      </Alert>
    </Box>
  );
};

// Default loading fallback
const DefaultLoadingFallback: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px',
      p: 3,
    }}
  >
    <Box sx={{ textAlign: 'center' }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          border: '3px solid',
          borderColor: 'primary.main',
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
      <Typography variant="body2" color="text.secondary">
        Loading...
      </Typography>
    </Box>
  </Box>
);

// Higher-order component for lazy loading with error boundaries
export const withLazyLoading = <P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ComponentType,
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
) => {
  const LazyComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundary
      FallbackComponent={errorFallback || DefaultErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Suspense fallback={React.createElement(fallback || DefaultLoadingFallback)}>
        <Component {...props} ref={ref} />
      </Suspense>
    </ErrorBoundary>
  ));

  LazyComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`;
  
  return LazyComponent;
};

// Wrapper component for manual use with enhanced error handling
export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  children,
  fallback = DefaultLoadingFallback,
  errorFallback = DefaultErrorFallback,
}) => {
  const [errorCount, setErrorCount] = React.useState(0);
  
  const handleReset = React.useCallback(() => {
    setErrorCount(prev => prev + 1);
    
    // If multiple errors occur, it might be a persistent issue
    if (errorCount >= 2) {
      console.warn('Multiple chunk loading errors detected, forcing reload...');
      handlePersistentChunkError();
    }
  }, [errorCount]);
  
  return (
    <ErrorBoundary
      FallbackComponent={errorFallback}
      onReset={handleReset}
      resetKeys={[errorCount]} // Reset when error count changes
    >
      <Suspense fallback={React.createElement(fallback)}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

// Enhanced preload utility function
export const preloadComponent = (importFn: () => Promise<any>, componentName?: string) => {
  // Use the new safe preloading utility
  preloadComponentSafely(importFn, componentName);
};

// Route-based preloading hook (enhanced)
export const useRoutePreloading = () => {
  React.useEffect(() => {
    // Preload critical routes after initial render
    const timer = setTimeout(() => {
      // Preload dashboard and patients as they are most commonly accessed
      preloadComponent(() => import('../pages/ModernDashboardPage'));
      preloadComponent(() => import('../pages/Patients'));
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    // Preload secondary routes after a delay
    const timer = setTimeout(() => {
      preloadComponent(() => import('../pages/ClinicalNotes'));
      preloadComponent(() => import('../pages/Medications'));
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    // Preload additional routes based on user role/permissions
    const timer = setTimeout(() => {
      // These can be loaded later as they're less frequently accessed
      preloadComponent(() => import('../modules/reports-analytics/components/ReportsAnalyticsDashboard'));
      preloadComponent(() => import('../pages/MedicationTherapyReview'));
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
};