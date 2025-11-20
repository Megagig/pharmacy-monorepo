import React, { useState, useEffect, useCallback } from 'react';
import { Box, Snackbar, Alert, Backdrop } from '@mui/material';
import toast from 'react-hot-toast';
import ClinicalNotesErrorBoundary from './ClinicalNotesErrorBoundary';
import ClinicalNotesOfflineIndicator from './ClinicalNotesOfflineIndicator';
import { ClinicalNotesLoadingState } from './ClinicalNotesLoadingStates';
import { useClinicalNotesErrorHandling } from '../hooks/useClinicalNotesErrorHandling';

interface ClinicalNotesUXEnhancerProps {
  children: React.ReactNode;
  showOfflineIndicator?: boolean;
  showGlobalLoading?: boolean;
  context?: string;
}

interface GlobalState {
  isLoading: boolean;
  loadingMessage: string;
  hasNetworkError: boolean;
  isRecovering: boolean;
}

const ClinicalNotesUXEnhancer: React.FC<ClinicalNotesUXEnhancerProps> = ({
  children,
  showOfflineIndicator = true,
  showGlobalLoading = true,
  context = 'clinical-notes-app',
}) => {
  const [globalState, setGlobalState] = useState<GlobalState>({
    isLoading: false,
    loadingMessage: '',
    hasNetworkError: false,
    isRecovering: false,
  });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { getErrors, hasErrors } = useClinicalNotesErrorHandling();

  // Monitor global loading states
  useEffect(() => {
    const handleLoadingStart = (event: CustomEvent) => {
      setGlobalState((prev) => ({
        ...prev,
        isLoading: true,
        loadingMessage: event.detail?.message || 'Loading...',
      }));
    };

    const handleLoadingEnd = () => {
      setGlobalState((prev) => ({
        ...prev,
        isLoading: false,
        loadingMessage: '',
      }));
    };

    const handleNetworkError = () => {
      setGlobalState((prev) => ({
        ...prev,
        hasNetworkError: true,
      }));
    };

    const handleNetworkRecovery = () => {
      setGlobalState((prev) => ({
        ...prev,
        hasNetworkError: false,
        isRecovering: true,
      }));

      // Clear recovery state after a delay
      setTimeout(() => {
        setGlobalState((prev) => ({
          ...prev,
          isRecovering: false,
        }));
      }, 3000);
    };

    // Listen for custom events
    window.addEventListener(
      'clinical-notes-loading-start',
      handleLoadingStart as EventListener
    );
    window.addEventListener('clinical-notes-loading-end', handleLoadingEnd);
    window.addEventListener('clinical-notes-network-error', handleNetworkError);
    window.addEventListener(
      'clinical-notes-network-recovery',
      handleNetworkRecovery
    );

    return () => {
      window.removeEventListener(
        'clinical-notes-loading-start',
        handleLoadingStart as EventListener
      );
      window.removeEventListener(
        'clinical-notes-loading-end',
        handleLoadingEnd
      );
      window.removeEventListener(
        'clinical-notes-network-error',
        handleNetworkError
      );
      window.removeEventListener(
        'clinical-notes-network-recovery',
        handleNetworkRecovery
      );
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (globalState.hasNetworkError) {
        window.dispatchEvent(
          new CustomEvent('clinical-notes-network-recovery')
        );
        showSuccessToast('Connection restored. Syncing data...');
      }
    };

    const handleOffline = () => {
      window.dispatchEvent(new CustomEvent('clinical-notes-network-error'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [globalState.hasNetworkError]);

  // Handle sync completion
  const handleSyncComplete = useCallback(() => {
    showSuccessToast('Clinical notes synced successfully');
  }, []);

  // Handle sync errors
  const handleSyncError = useCallback((error: Error) => {
    toast.error(`Sync failed: ${error.message}`);
  }, []);

  // Show success toast
  const showSuccessToast = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
  };

  // Utility functions for child components
  const triggerGlobalLoading = useCallback((message: string = 'Loading...') => {
    window.dispatchEvent(
      new CustomEvent('clinical-notes-loading-start', {
        detail: { message },
      })
    );
  }, []);

  const stopGlobalLoading = useCallback(() => {
    window.dispatchEvent(new CustomEvent('clinical-notes-loading-end'));
  }, []);

  // Provide context to child components
  const contextValue = {
    triggerGlobalLoading,
    stopGlobalLoading,
    showSuccessToast,
    globalState,
  };

  return (
    <ClinicalNotesErrorBoundary
      context={context}
      onError={(error, errorInfo) => {
        // Log error to monitoring service
        console.error('Clinical Notes UX Error:', {
          error,
          errorInfo,
          context,
        });
      }}
    >
      <ClinicalNotesUXContext.Provider value={contextValue}>
        <Box sx={{ position: 'relative', minHeight: '100%' }}>
          {children}

          {/* Global Loading Overlay */}
          {showGlobalLoading && (
            <Backdrop
              sx={{
                color: '#fff',
                zIndex: (theme) => theme.zIndex.drawer + 1,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}
              open={globalState.isLoading}
            >
              <ClinicalNotesLoadingState
                type="loading"
                message={globalState.loadingMessage}
                size="large"
              />
            </Backdrop>
          )}

          {/* Offline Indicator */}
          {showOfflineIndicator && (
            <ClinicalNotesOfflineIndicator
              onSyncComplete={handleSyncComplete}
              onSyncError={handleSyncError}
            />
          )}

          {/* Success Message Snackbar */}
          <Snackbar
            open={showSuccessMessage}
            autoHideDuration={4000}
            onClose={() => setShowSuccessMessage(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={() => setShowSuccessMessage(false)}
              severity="success"
              variant="filled"
            >
              {successMessage}
            </Alert>
          </Snackbar>

          {/* Network Recovery Message */}
          <Snackbar
            open={globalState.isRecovering}
            autoHideDuration={3000}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert severity="info" variant="filled">
              Connection restored. Syncing clinical notes...
            </Alert>
          </Snackbar>
        </Box>
      </ClinicalNotesUXContext.Provider>
    </ClinicalNotesErrorBoundary>
  );
};

// Context for child components to access UX utilities
const ClinicalNotesUXContext = React.createContext<{
  triggerGlobalLoading: (message?: string) => void;
  stopGlobalLoading: () => void;
  showSuccessToast: (message: string) => void;
  globalState: GlobalState;
} | null>(null);

// Hook for child components to use UX utilities
export const useClinicalNotesUX = () => {
  const context = React.useContext(ClinicalNotesUXContext);
  if (!context) {
    throw new Error(
      'useClinicalNotesUX must be used within ClinicalNotesUXEnhancer'
    );
  }
  return context;
};

// Higher-order component for easy wrapping
export const withClinicalNotesUX = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    showOfflineIndicator?: boolean;
    showGlobalLoading?: boolean;
    context?: string;
  }
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <ClinicalNotesUXEnhancer {...options}>
      <Component {...props} />
    </ClinicalNotesUXEnhancer>
  );

  WrappedComponent.displayName = `withClinicalNotesUX(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
};

export default ClinicalNotesUXEnhancer;
