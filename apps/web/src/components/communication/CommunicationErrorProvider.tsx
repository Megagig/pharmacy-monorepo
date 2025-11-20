import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Snackbar, Alert, Portal } from '@mui/material';
import CommunicationErrorBoundary from './CommunicationErrorBoundary';
import ErrorRecoveryDialog from './ErrorRecoveryDialog';
import OfflineModeHandler from './OfflineModeHandler';
import { 
  communicationErrorService, 
  CommunicationError, 
  ErrorHandlingOptions 
} from '../../services/communicationErrorService';
import { errorReportingService } from '../../services/errorReportingService';
import { retryMechanism } from '../../utils/retryMechanism';

interface ErrorContextValue {
  // Error state
  currentError: CommunicationError | null;
  errorHistory: CommunicationError[];
  
  // Error handling methods
  reportError: (error: unknown, options?: ErrorHandlingOptions) => Promise<CommunicationError>;
  clearError: () => void;
  clearAllErrors: () => void;
  
  // Recovery methods
  showRecoveryDialog: (error: CommunicationError) => void;
  hideRecoveryDialog: () => void;
  retryLastOperation: () => Promise<void>;
  
  // Configuration
  setErrorHandlingEnabled: (enabled: boolean) => void;
  setOfflineModeEnabled: (enabled: boolean) => void;
  
  // Statistics
  getErrorStats: () => any;
}

interface CommunicationErrorProviderProps {
  children: React.ReactNode;
  
  // Configuration options
  enableErrorBoundary?: boolean;
  enableOfflineMode?: boolean;
  enableErrorReporting?: boolean;
  enableAutoRecovery?: boolean;
  
  // UI options
  showErrorToasts?: boolean;
  showRecoveryDialog?: boolean;
  maxToastErrors?: number;
  
  // Callbacks
  onError?: (error: CommunicationError) => void;
  onRecovery?: (error: CommunicationError) => void;
  onCriticalError?: (error: CommunicationError) => void;
}

// Create error context
const ErrorContext = createContext<ErrorContextValue | null>(null);

/**
 * Comprehensive error handling provider for Communication Hub
 * Integrates all error handling features into a single, easy-to-use provider
 */
export const CommunicationErrorProvider: React.FC<CommunicationErrorProviderProps> = ({
  children,
  enableErrorBoundary = true,
  enableOfflineMode = true,
  enableErrorReporting = true,
  enableAutoRecovery = true,
  showErrorToasts = true,
  showRecoveryDialog = true,
  maxToastErrors = 3,
  onError,
  onRecovery,
  onCriticalError,
}) => {
  // Error state
  const [currentError, setCurrentError] = useState<CommunicationError | null>(null);
  const [errorHistory, setErrorHistory] = useState<CommunicationError[]>([]);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryError, setRecoveryError] = useState<CommunicationError | null>(null);
  const [toastErrors, setToastErrors] = useState<CommunicationError[]>([]);
  const [lastOperation, setLastOperation] = useState<(() => Promise<void>) | null>(null);
  
  // Configuration state
  const [errorHandlingEnabled, setErrorHandlingEnabled] = useState(true);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(enableOfflineMode);

  // Initialize error reporting
  useEffect(() => {
    if (enableErrorReporting) {
      errorReportingService.updateConfig({
        enabled: true,
        includeUserInteractions: true,
        includePerformanceMetrics: true,
      });
    }

    return () => {
      if (enableErrorReporting) {
        errorReportingService.destroy();
      }
    };
  }, [enableErrorReporting]);

  // Set up error listener
  useEffect(() => {
    const removeListener = communicationErrorService.addErrorListener((error) => {
      handleNewError(error);
    });

    return removeListener;
  }, []);

  /**
   * Handle new error from error service
   */
  const handleNewError = useCallback((error: CommunicationError) => {
    setCurrentError(error);
    setErrorHistory(prev => [...prev, error].slice(-50)); // Keep last 50 errors

    // Call custom error handler
    if (onError) {
      onError(error);
    }

    // Handle critical errors
    if (error.severity === 'critical' && onCriticalError) {
      onCriticalError(error);
    }

    // Show toast for non-critical errors
    if (showErrorToasts && error.severity !== 'critical') {
      setToastErrors(prev => {
        const newToasts = [...prev, error].slice(-maxToastErrors);
        return newToasts;
      });
    }

    // Auto-show recovery dialog for high/critical errors
    if (showRecoveryDialog && (error.severity === 'high' || error.severity === 'critical')) {
      showRecoveryDialogForError(error);
    }

    // Report to error reporting service
    if (enableErrorReporting) {
      errorReportingService.reportError(error, {
        component: 'communication-error-provider',
        action: 'error-handled',
      });
    }
  }, [onError, onCriticalError, showErrorToasts, showRecoveryDialog, maxToastErrors, enableErrorReporting]);

  /**
   * Report an error through the error service
   */
  const reportError = useCallback(async (
    error: unknown, 
    options: ErrorHandlingOptions = {}
  ): Promise<CommunicationError> => {
    if (!errorHandlingEnabled) {
      throw new Error('Error handling is disabled');
    }

    const handledError = await communicationErrorService.handleError(error, {
      showToast: false, // We handle toasts in the provider
      ...options,
    });

    return handledError;
  }, [errorHandlingEnabled]);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setCurrentError(null);
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setCurrentError(null);
    setErrorHistory([]);
    setToastErrors([]);
    communicationErrorService.clearErrorHistory();
  }, []);

  /**
   * Show recovery dialog for specific error
   */
  const showRecoveryDialogForError = useCallback((error: CommunicationError) => {
    setRecoveryError(error);
    setRecoveryDialogOpen(true);
  }, []);

  /**
   * Hide recovery dialog
   */
  const hideRecoveryDialog = useCallback(() => {
    setRecoveryDialogOpen(false);
    setRecoveryError(null);
  }, []);

  /**
   * Retry last operation
   */
  const retryLastOperation = useCallback(async () => {
    if (lastOperation) {
      try {
        await lastOperation();
        
        // Clear error on successful retry
        setCurrentError(null);
        
        if (onRecovery && currentError) {
          onRecovery(currentError);
        }
      } catch (error) {
        // Handle retry failure
        await reportError(error, { context: 'retry-operation' });
      }
    }
  }, [lastOperation, currentError, onRecovery, reportError]);

  /**
   * Register operation for retry
   */
  const registerOperation = useCallback((operation: () => Promise<void>) => {
    setLastOperation(() => operation);
  }, []);

  /**
   * Remove toast error
   */
  const removeToastError = useCallback((errorToRemove: CommunicationError) => {
    setToastErrors(prev => prev.filter(error => error !== errorToRemove));
  }, []);

  /**
   * Get error statistics
   */
  const getErrorStats = useCallback(() => {
    return {
      communication: communicationErrorService.getErrorStats(),
      reporting: errorReportingService.getErrorStats(),
      current: {
        hasError: !!currentError,
        errorCount: errorHistory.length,
        toastCount: toastErrors.length,
      },
    };
  }, [currentError, errorHistory.length, toastErrors.length]);

  // Context value
  const contextValue: ErrorContextValue = {
    currentError,
    errorHistory,
    reportError,
    clearError,
    clearAllErrors,
    showRecoveryDialog: showRecoveryDialogForError,
    hideRecoveryDialog,
    retryLastOperation,
    setErrorHandlingEnabled,
    setOfflineModeEnabled,
    getErrorStats,
  };

  // Render component tree with error handling
  const renderContent = () => {
    let content = children;

    // Wrap with offline mode handler
    if (offlineModeEnabled) {
      content = (
        <OfflineModeHandler
          enableOfflineMode={true}
          showOfflineIndicator={true}
          autoSync={enableAutoRecovery}
        >
          {content}
        </OfflineModeHandler>
      );
    }

    // Wrap with error boundary
    if (enableErrorBoundary) {
      content = (
        <CommunicationErrorBoundary
          context="communication-provider"
          enableRetry={enableAutoRecovery}
          enableOfflineMode={offlineModeEnabled}
          onError={(error, errorInfo) => {
            reportError(error, {
              context: 'error-boundary',
              logError: true,
              trackMetrics: true,
            });
          }}
        >
          {content}
        </CommunicationErrorBoundary>
      );
    }

    return content;
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {renderContent()}

      {/* Error Toast Notifications */}
      {toastErrors.map((error, index) => (
        <Snackbar
          key={`${error.timestamp}-${index}`}
          open={true}
          autoHideDuration={6000}
          onClose={() => removeToastError(error)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: index * 8 }} // Stack toasts
        >
          <Alert
            severity={error.severity === 'critical' ? 'error' : 'warning'}
            onClose={() => removeToastError(error)}
            action={
              error.retryable && (
                <button
                  onClick={() => {
                    removeToastError(error);
                    retryLastOperation();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )
            }
          >
            {error.userMessage}
          </Alert>
        </Snackbar>
      ))}

      {/* Error Recovery Dialog */}
      <Portal>
        <ErrorRecoveryDialog
          open={recoveryDialogOpen}
          error={recoveryError}
          onClose={hideRecoveryDialog}
          onRetry={retryLastOperation}
          onRecover={() => {
            hideRecoveryDialog();
            if (onRecovery && recoveryError) {
              onRecovery(recoveryError);
            }
          }}
          showTechnicalDetails={process.env.NODE_ENV === 'development'}
        />
      </Portal>
    </ErrorContext.Provider>
  );
};

/**
 * Hook to use error context
 */
export const useCommunicationError = (): ErrorContextValue => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useCommunicationError must be used within CommunicationErrorProvider');
  }
  return context;
};

/**
 * Hook for error-aware operations
 */
export const useErrorAwareOperation = () => {
  const { reportError } = useCommunicationError();

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    try {
      return await retryMechanism.executeWithRetry(
        operation,
        operationName,
        {
          maxAttempts: 3,
          onRetry: (attempt, error) => {
          },
        }
      );
    } catch (error) {
      await reportError(error, {
        context: operationName,
        enableRetry: true,
        ...options,
      });
      throw error;
    }
  }, [reportError]);

  return { executeWithErrorHandling };
};

/**
 * HOC for wrapping components with error handling
 */
export const withErrorHandling = <P extends object>(
  Component: React.ComponentType<P>,
  options: Partial<CommunicationErrorProviderProps> = {}
) => {
  const WrappedComponent = (props: P) => (
    <CommunicationErrorProvider {...options}>
      <Component {...props} />
    </CommunicationErrorProvider>
  );

  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default CommunicationErrorProvider;