import toast from 'react-hot-toast';

// Error types and interfaces
export interface AppError {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoveryAction: 'retry' | 'refresh' | 'contact_support' | 'validate_input' | 'check_permissions' | 'check_network' | 'none';
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
    technicalMessage?: string;
    stack?: string;
}

export interface ErrorHandlingOptions {
    showToast?: boolean;
    logError?: boolean;
    trackMetrics?: boolean;
    autoRetry?: boolean;
    maxRetries?: number;
    retryDelay?: number;
}

// Error classification
export class ErrorClassifier {
    static classifyError(error: any): AppError {
        const timestamp = new Date().toISOString();

        // Network errors
        if (this.isNetworkError(error)) {
            return {
                type: 'NETWORK_ERROR',
                message: 'Network connection failed. Please check your internet connection.',
                severity: 'high',
                recoveryAction: 'check_network',
                timestamp,
                details: { originalError: error.message }
            };
        }

        // Validation errors
        if (this.isValidationError(error)) {
            return {
                type: 'VALIDATION_ERROR',
                message: 'Please check your input and try again.',
                severity: 'low',
                recoveryAction: 'validate_input',
                timestamp,
                details: this.extractValidationDetails(error)
            };
        }

        // Permission errors
        if (this.isPermissionError(error)) {
            return {
                type: 'PERMISSION_ERROR',
                message: 'You do not have permission to perform this action.',
                severity: 'medium',
                recoveryAction: 'check_permissions',
                timestamp,
                details: { statusCode: error.response?.status }
            };
        }

        // Server errors
        if (this.isServerError(error)) {
            return {
                type: 'SERVER_ERROR',
                message: 'Server error occurred. Please try again later.',
                severity: 'high',
                recoveryAction: 'retry',
                timestamp,
                details: {
                    statusCode: error.response?.status,
                    serverMessage: error.response?.data?.message
                }
            };
        }

        // Default unknown error
        return {
            type: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred. Please try again.',
            severity: 'medium',
            recoveryAction: 'retry',
            timestamp,
            details: { originalError: error.message || String(error) }
        };
    }

    private static isNetworkError(error: any): boolean {
        return !error.response ||
            error.code === 'NETWORK_ERROR' ||
            error.message === 'Network Error' ||
            error.code === 'ECONNABORTED';
    }

    private static isValidationError(error: any): boolean {
        return error.response?.status === 400 ||
            error.response?.status === 422 ||
            (error.response?.data?.errors && Array.isArray(error.response.data.errors));
    }

    private static isPermissionError(error: any): boolean {
        return error.response?.status === 401 ||
            error.response?.status === 403;
    }

    private static isServerError(error: any): boolean {
        return error.response?.status >= 500;
    }

    private static extractValidationDetails(error: any): Record<string, any> {
        const details: Record<string, any> = {};

        if (error.response?.data?.errors) {
            details.validationErrors = error.response.data.errors;
        }

        if (error.response?.data?.message) {
            details.serverMessage = error.response.data.message;
        }

        return details;
    }
}

// Error handling service
export class ErrorHandlingService {
    private static instance: ErrorHandlingService;
    private errorLog: AppError[] = [];
    private retryAttempts: Map<string, number> = new Map();

    static getInstance(): ErrorHandlingService {
        if (!ErrorHandlingService.instance) {
            ErrorHandlingService.instance = new ErrorHandlingService();
        }
        return ErrorHandlingService.instance;
    }

    // Handle error with comprehensive processing
    handleError(
        error: any,
        context: string = 'unknown',
        options: ErrorHandlingOptions = {}
    ): AppError {
        const {
            showToast = true,
            logError = true,
            trackMetrics = true,
            autoRetry = false,
            maxRetries = 3,
            retryDelay = 1000
        } = options;

        // Classify the error
        const appError = ErrorClassifier.classifyError(error);
        appError.details = { ...appError.details, context };

        // Log error
        if (logError) {
            this.logError(appError, context);
        }

        // Track metrics
        if (trackMetrics) {
            this.trackErrorMetrics(appError, context);
        }

        // Show user notification
        if (showToast) {
            this.showErrorToast(appError);
        }

        // Auto-retry if enabled and appropriate
        if (autoRetry && this.shouldAutoRetry(appError, context, maxRetries)) {
            this.scheduleRetry(error, context, options, retryDelay);
        }

        return appError;
    }

    // Log error for debugging and monitoring
    private logError(error: AppError, context: string): void {
        console.error(`[${error.severity.toUpperCase()}] ${error.type} in ${context}:`, {
            message: error.message,
            details: error.details,
            timestamp: error.timestamp,
            technicalMessage: error.technicalMessage,
            stack: error.stack
        });

        // Add to error log
        this.errorLog.push(error);

        // Keep only last 100 errors
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-100);
        }
    }

    // Track error metrics
    private trackErrorMetrics(error: AppError, context: string): void {
        // In a real implementation, you would send metrics to your monitoring service
        const metrics = {
            errorType: error.type,
            severity: error.severity,
            context,
            timestamp: error.timestamp,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Example: Send to analytics service
        if (import.meta.env.PROD) {
            // analytics.track('error_occurred', metrics);
        }

        console.debug('Error metrics:', metrics);
    }

    // Show user-friendly error notification
    private showErrorToast(error: AppError): void {
        const toastOptions = {
            position: 'top-right' as const,
            autoClose: this.getToastDuration(error.severity),
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
        };

        switch (error.severity) {
            case 'critical':
            case 'high':
                toast.error(error.message, toastOptions);
                break;
            case 'medium':
                toast.warn(error.message, toastOptions);
                break;
            case 'low':
                toast.info(error.message, toastOptions);
                break;
        }
    }

    // Determine if error should be auto-retried
    private shouldAutoRetry(error: AppError, context: string, maxRetries: number): boolean {
        const retryKey = `${context}_${error.type}`;
        const currentAttempts = this.retryAttempts.get(retryKey) || 0;

        return error.recoveryAction === 'retry' &&
            currentAttempts < maxRetries &&
            error.severity !== 'critical';
    }

    // Schedule automatic retry
    private scheduleRetry(
        originalError: any,
        context: string,
        options: ErrorHandlingOptions,
        delay: number
    ): void {
        const retryKey = `${context}_${ErrorClassifier.classifyError(originalError).type}`;
        const currentAttempts = this.retryAttempts.get(retryKey) || 0;

        this.retryAttempts.set(retryKey, currentAttempts + 1);

        setTimeout(() => {
            // The actual retry logic would be implemented by the calling code
            // This is just scheduling the retry
        }, delay * Math.pow(2, currentAttempts)); // Exponential backoff
    }

    // Get toast duration based on severity
    private getToastDuration(severity: string): number {
        switch (severity) {
            case 'critical':
                return 10000; // 10 seconds
            case 'high':
                return 7000;  // 7 seconds
            case 'medium':
                return 5000;  // 5 seconds
            case 'low':
                return 3000;  // 3 seconds
            default:
                return 5000;
        }
    }

    // Get recovery instructions for user
    getRecoveryInstructions(error: AppError): string[] {
        switch (error.recoveryAction) {
            case 'retry':
                return [
                    'Wait a moment and try again',
                    'Check your internet connection',
                    'If the problem persists, contact support'
                ];

            case 'refresh':
                return [
                    'Refresh the page and try again',
                    'Make sure you have the latest data',
                    'Clear your browser cache if needed'
                ];

            case 'validate_input':
                return [
                    'Check your input for errors',
                    'Make sure all required fields are filled',
                    'Verify the data format is correct'
                ];

            case 'check_permissions':
                return [
                    'Contact your administrator for access',
                    'Make sure you have the required permissions',
                    'Try logging out and back in'
                ];

            case 'check_network':
                return [
                    'Check your internet connection',
                    'Try refreshing the page',
                    'Contact IT support if connection issues persist'
                ];

            case 'contact_support':
                return [
                    'Contact technical support',
                    'Provide the error details and timestamp',
                    'Include steps to reproduce the issue'
                ];

            default:
                return [
                    'Try the action again',
                    'If the problem persists, contact support'
                ];
        }
    }

    // Clear retry attempts for a context
    clearRetryAttempts(context: string): void {
        const keysToDelete = Array.from(this.retryAttempts.keys())
            .filter(key => key.startsWith(context));

        keysToDelete.forEach(key => this.retryAttempts.delete(key));
    }

    // Get error log
    getErrorLog(): AppError[] {
        return [...this.errorLog];
    }

    // Clear error log
    clearErrorLog(): void {
        this.errorLog = [];
    }

    // Export error log for support
    exportErrorLog(): string {
        return JSON.stringify(this.errorLog, null, 2);
    }
}

// Singleton instance
export const errorHandlingService = ErrorHandlingService.getInstance();

// Utility functions
export const handleApiError = (
    error: any,
    context: string = 'api_call',
    options?: ErrorHandlingOptions
): AppError => {
    return errorHandlingService.handleError(error, context, options);
};

export const handleFormError = (
    error: any,
    formName: string = 'form',
    options?: ErrorHandlingOptions
): AppError => {
    return errorHandlingService.handleError(error, `form_${formName}`, {
        showToast: true,
        autoRetry: false,
        ...options
    });
};

export const handleNetworkError = (
    error: any,
    operation: string = 'network_operation',
    options?: ErrorHandlingOptions
): AppError => {
    return errorHandlingService.handleError(error, `network_${operation}`, {
        showToast: true,
        autoRetry: true,
        maxRetries: 3,
        ...options
    });
};

// React hook for error handling
export const useErrorHandler = () => {
    const handleError = React.useCallback((
        error: any,
        context?: string,
        options?: ErrorHandlingOptions
    ) => {
        return errorHandlingService.handleError(error, context, options);
    }, []);

    const getRecoveryInstructions = React.useCallback((error: AppError) => {
        return errorHandlingService.getRecoveryInstructions(error);
    }, []);

    const clearRetryAttempts = React.useCallback((context: string) => {
        errorHandlingService.clearRetryAttempts(context);
    }, []);

    return {
        handleError,
        getRecoveryInstructions,
        clearRetryAttempts,
        errorLog: errorHandlingService.getErrorLog()
    };
};

export default {
    ErrorHandlingService,
    ErrorClassifier,
    errorHandlingService,
    handleApiError,
    handleFormError,
    handleNetworkError,
    useErrorHandler
};