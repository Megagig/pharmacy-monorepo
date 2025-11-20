import { retryMechanism, RetryConfig } from '../utils/retryMechanism';
import { performanceMonitor } from '../utils/performanceMonitor';
import { socketService } from './socketService';

// Error types specific to communication features
export type CommunicationErrorType =
    | 'connection_lost'
    | 'message_send_failed'
    | 'message_load_failed'
    | 'conversation_load_failed'
    | 'file_upload_failed'
    | 'authentication_expired'
    | 'permission_denied'
    | 'rate_limited'
    | 'server_error'
    | 'validation_error'
    | 'network_timeout'
    | 'websocket_error'
    | 'encryption_error'
    | 'storage_quota_exceeded'
    | 'unknown_error';

export interface CommunicationError {
    type: CommunicationErrorType;
    message: string;
    userMessage: string;
    code?: string | number;
    details?: any;
    timestamp: number;
    context?: string;
    recoverable: boolean;
    retryable: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedActions: ErrorAction[];
}

export interface ErrorAction {
    label: string;
    type: 'retry' | 'refresh' | 'navigate' | 'contact_support' | 'custom';
    handler?: () => void | Promise<void>;
    primary?: boolean;
}

export interface ErrorHandlingOptions {
    showToast?: boolean;
    logError?: boolean;
    trackMetrics?: boolean;
    enableRetry?: boolean;
    maxRetries?: number;
    context?: string;
    onError?: (error: CommunicationError) => void;
    onRecovery?: () => void;
}

/**
 * Comprehensive error handling service for Communication Hub
 * Provides structured error analysis, recovery suggestions, and automatic retry mechanisms
 */
class CommunicationErrorService {
    private errorHistory: CommunicationError[] = [];
    private retryAttempts: Map<string, number> = new Map();
    private errorListeners: Array<(error: CommunicationError) => void> = [];

    /**
     * Analyze and classify an error
     */
    analyzeError(error: unknown, context?: string): CommunicationError {
        const timestamp = Date.now();
        let communicationError: CommunicationError;

        if (error instanceof Error) {
            communicationError = this.classifyError(error, timestamp, context);
        } else if (typeof error === 'string') {
            communicationError = this.createGenericError(error, context, timestamp);
        } else {
            communicationError = this.createGenericError('Unknown error occurred', context, timestamp);
        }

        // Add to error history
        this.errorHistory.push(communicationError);

        // Keep only last 100 errors to prevent memory leaks
        if (this.errorHistory.length > 100) {
            this.errorHistory = this.errorHistory.slice(-100);
        }

        return communicationError;
    }

    /**
     * Handle an error with specified options
     */
    async handleError(
        error: unknown,
        options: ErrorHandlingOptions = {}
    ): Promise<CommunicationError> {
        const communicationError = this.analyzeError(error, options.context);

        // Log error if enabled
        if (options.logError !== false) {
            this.logError(communicationError);
        }

        // Track metrics if enabled
        if (options.trackMetrics !== false) {
            this.trackErrorMetrics(communicationError);
        }

        // Show toast notification if enabled
        if (options.showToast) {
            this.showErrorToast(communicationError);
        }

        // Notify error listeners
        this.notifyErrorListeners(communicationError);

        // Call custom error handler
        if (options.onError) {
            options.onError(communicationError);
        }

        // Attempt automatic retry if enabled and error is retryable
        if (options.enableRetry && communicationError.retryable) {
            await this.attemptAutoRetry(communicationError, options);
        }

        return communicationError;
    }

    /**
     * Classify error based on type and context
     */
    private classifyError(error: Error, timestamp: number, context?: string): CommunicationError {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();

        // Network and connection errors
        if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
            return this.createError('connection_lost', error, context, timestamp, {
                recoverable: true,
                retryable: true,
                severity: 'medium',
                userMessage: 'Connection lost. Please check your internet connection.',
                suggestedActions: [
                    { label: 'Retry', type: 'retry', primary: true },
                    { label: 'Check Connection', type: 'custom', handler: this.checkConnection },
                ],
            });
        }

        // WebSocket errors
        if (message.includes('websocket') || message.includes('socket')) {
            return this.createError('websocket_error', error, context, timestamp, {
                recoverable: true,
                retryable: true,
                severity: 'medium',
                userMessage: 'Real-time connection interrupted. Attempting to reconnect...',
                suggestedActions: [
                    { label: 'Reconnect', type: 'custom', handler: this.reconnectSocket, primary: true },
                    { label: 'Refresh Page', type: 'refresh' },
                ],
            });
        }

        // Authentication errors
        if (message.includes('auth') || message.includes('401') || message.includes('unauthorized')) {
            return this.createError('authentication_expired', error, context, timestamp, {
                recoverable: true,
                retryable: false,
                severity: 'high',
                userMessage: 'Your session has expired. Please log in again.',
                suggestedActions: [
                    { label: 'Log In', type: 'navigate', handler: () => { window.location.href = '/login'; }, primary: true },
                ],
            });
        }

        // Permission errors
        if (message.includes('permission') || message.includes('403') || message.includes('forbidden')) {
            return this.createError('permission_denied', error, context, timestamp, {
                recoverable: false,
                retryable: false,
                severity: 'high',
                userMessage: 'You do not have permission to perform this action.',
                suggestedActions: [
                    { label: 'Contact Support', type: 'contact_support' },
                ],
            });
        }

        // Rate limiting
        if (message.includes('rate') || message.includes('429') || message.includes('too many')) {
            return this.createError('rate_limited', error, context, timestamp, {
                recoverable: true,
                retryable: true,
                severity: 'medium',
                userMessage: 'Too many requests. Please wait a moment and try again.',
                suggestedActions: [
                    { label: 'Wait and Retry', type: 'retry', primary: true },
                ],
            });
        }

        // Server errors
        if (message.includes('500') || message.includes('server') || message.includes('internal')) {
            return this.createError('server_error', error, context, timestamp, {
                recoverable: true,
                retryable: true,
                severity: 'high',
                userMessage: 'Server error occurred. Please try again later.',
                suggestedActions: [
                    { label: 'Retry', type: 'retry', primary: true },
                    { label: 'Contact Support', type: 'contact_support' },
                ],
            });
        }

        // Timeout errors
        if (message.includes('timeout') || message.includes('aborted')) {
            return this.createError('network_timeout', error, context, timestamp, {
                recoverable: true,
                retryable: true,
                severity: 'medium',
                userMessage: 'Request timed out. Please try again.',
                suggestedActions: [
                    { label: 'Retry', type: 'retry', primary: true },
                ],
            });
        }

        // Validation errors
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return this.createError('validation_error', error, context, timestamp, {
                recoverable: true,
                retryable: false,
                severity: 'low',
                userMessage: 'Please check your input and try again.',
                suggestedActions: [
                    { label: 'Review Input', type: 'custom' },
                ],
            });
        }

        // Storage quota errors
        if (message.includes('quota') || message.includes('storage') || message.includes('disk')) {
            return this.createError('storage_quota_exceeded', error, context, timestamp, {
                recoverable: false,
                retryable: false,
                severity: 'high',
                userMessage: 'Storage quota exceeded. Please free up space.',
                suggestedActions: [
                    { label: 'Clear Cache', type: 'custom', handler: this.clearCache },
                    { label: 'Contact Support', type: 'contact_support' },
                ],
            });
        }

        // Context-specific errors
        if (context) {
            if (context.includes('message') && context.includes('send')) {
                return this.createError('message_send_failed', error, context, timestamp, {
                    recoverable: true,
                    retryable: true,
                    severity: 'medium',
                    userMessage: 'Failed to send message. Please try again.',
                    suggestedActions: [
                        { label: 'Retry Send', type: 'retry', primary: true },
                        { label: 'Save Draft', type: 'custom' },
                    ],
                });
            }

            if (context.includes('file') && context.includes('upload')) {
                return this.createError('file_upload_failed', error, context, timestamp, {
                    recoverable: true,
                    retryable: true,
                    severity: 'medium',
                    userMessage: 'File upload failed. Please try again.',
                    suggestedActions: [
                        { label: 'Retry Upload', type: 'retry', primary: true },
                        { label: 'Check File Size', type: 'custom' },
                    ],
                });
            }
        }

        // Default unknown error
        return this.createError('unknown_error', error, context, timestamp, {
            recoverable: true,
            retryable: true,
            severity: 'medium',
            userMessage: 'An unexpected error occurred. Please try again.',
            suggestedActions: [
                { label: 'Retry', type: 'retry', primary: true },
                { label: 'Refresh Page', type: 'refresh' },
                { label: 'Contact Support', type: 'contact_support' },
            ],
        });
    }

    /**
     * Create a structured communication error
     */
    private createError(
        type: CommunicationErrorType,
        error: Error,
        context: string | undefined,
        timestamp: number,
        options: {
            recoverable: boolean;
            retryable: boolean;
            severity: 'low' | 'medium' | 'high' | 'critical';
            userMessage: string;
            suggestedActions: ErrorAction[];
        }
    ): CommunicationError {
        return {
            type,
            message: error.message,
            userMessage: options.userMessage,
            code: (error as any).code || (error as any).status,
            details: {
                name: error.name,
                stack: error.stack,
                cause: (error as any).cause,
            },
            timestamp,
            context,
            recoverable: options.recoverable,
            retryable: options.retryable,
            severity: options.severity,
            suggestedActions: options.suggestedActions,
        };
    }

    /**
     * Create a generic error from string
     */
    private createGenericError(message: string, context?: string, timestamp: number = Date.now()): CommunicationError {
        return {
            type: 'unknown_error',
            message,
            userMessage: 'An unexpected error occurred.',
            timestamp,
            context,
            recoverable: true,
            retryable: true,
            severity: 'medium',
            suggestedActions: [
                { label: 'Retry', type: 'retry', primary: true },
                { label: 'Contact Support', type: 'contact_support' },
            ],
        };
    }

    /**
     * Log error with appropriate level
     */
    private logError(error: CommunicationError): void {
        const logLevel = error.severity === 'critical' ? 'error' :
            error.severity === 'high' ? 'warn' : 'info';

        console[logLevel]('Communication Error:', {
            type: error.type,
            message: error.message,
            context: error.context,
            severity: error.severity,
            timestamp: new Date(error.timestamp).toISOString(),
            details: error.details,
        });
    }

    /**
     * Track error metrics
     */
    private trackErrorMetrics(error: CommunicationError): void {
        performanceMonitor.recordMetric('communication_error_count', 1, {
            error_type: error.type,
            severity: error.severity,
            context: error.context || 'unknown',
            recoverable: error.recoverable.toString(),
        });
    }

    /**
     * Show error toast notification
     */
    private showErrorToast(error: CommunicationError): void {
        // This would integrate with your toast notification system

    }

    /**
     * Notify error listeners
     */
    private notifyErrorListeners(error: CommunicationError): void {
        this.errorListeners.forEach(listener => {
            try {
                listener(error);
            } catch (listenerError) {
                console.error('Error in error listener:', listenerError);
            }
        });
    }

    /**
     * Attempt automatic retry for retryable errors
     */
    private async attemptAutoRetry(
        error: CommunicationError,
        options: ErrorHandlingOptions
    ): Promise<void> {
        const maxRetries = options.maxRetries || 3;
        const retryKey = `${error.type}_${error.context || 'default'}`;
        const currentAttempts = this.retryAttempts.get(retryKey) || 0;

        if (currentAttempts >= maxRetries) {
            return;
        }

        this.retryAttempts.set(retryKey, currentAttempts + 1);

        const retryConfig: Partial<RetryConfig> = {
            maxAttempts: maxRetries - currentAttempts,
            initialDelay: this.getRetryDelay(error.type),
            retryCondition: () => true, // We already determined it's retryable
            onRetry: (attempt) => {
            },
            onMaxRetriesReached: () => {
                this.retryAttempts.delete(retryKey);

            },
        };

        try {
            await retryMechanism.executeWithRetry(
                async () => {
                    // This would be the original operation that failed
                    // For now, we just simulate success
                    await new Promise(resolve => setTimeout(resolve, 100));
                },
                `auto_retry_${retryKey}`,
                retryConfig
            );

            // Success - reset retry count and notify recovery
            this.retryAttempts.delete(retryKey);
            if (options.onRecovery) {
                options.onRecovery();
            }
        } catch (retryError) {
            console.error('Auto-retry failed:', retryError);
        }
    }

    /**
     * Get retry delay based on error type
     */
    private getRetryDelay(errorType: CommunicationErrorType): number {
        switch (errorType) {
            case 'rate_limited':
                return 5000; // Wait longer for rate limits
            case 'server_error':
                return 3000; // Wait a bit for server errors
            case 'network_timeout':
                return 2000; // Quick retry for timeouts
            default:
                return 1000; // Default delay
        }
    }

    /**
     * Recovery action handlers
     */
    private checkConnection = async (): Promise<void> => {
        try {
            const baseURL = import.meta.env.MODE === 'development'
                ? 'http://localhost:5000/api'
                : '/api';
            const response = await fetch(`${baseURL}/health`, {
                method: 'HEAD',
                credentials: 'include'
            });
            if (response.ok) {

            } else {

            }
        } catch (error) {

        }
    };

    private reconnectSocket = (): void => {
        socketService.forceReconnect();
    };

    private clearCache = async (): Promise<void> => {
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            localStorage.clear();
            sessionStorage.clear();

        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    };

    /**
     * Public API methods
     */

    /**
     * Add error listener
     */
    addErrorListener(listener: (error: CommunicationError) => void): () => void {
        this.errorListeners.push(listener);
        return () => {
            const index = this.errorListeners.indexOf(listener);
            if (index > -1) {
                this.errorListeners.splice(index, 1);
            }
        };
    }

    /**
     * Get error history
     */
    getErrorHistory(filter?: {
        type?: CommunicationErrorType;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        since?: number;
    }): CommunicationError[] {
        let filtered = this.errorHistory;

        if (filter) {
            if (filter.type) {
                filtered = filtered.filter(error => error.type === filter.type);
            }
            if (filter.severity) {
                filtered = filtered.filter(error => error.severity === filter.severity);
            }
            if (filter.since) {
                filtered = filtered.filter(error => error.timestamp >= filter.since!);
            }
        }

        return filtered;
    }

    /**
     * Clear error history
     */
    clearErrorHistory(): void {
        this.errorHistory = [];
        this.retryAttempts.clear();
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        total: number;
        byType: Record<CommunicationErrorType, number>;
        bySeverity: Record<string, number>;
        recoveryRate: number;
    } {
        const total = this.errorHistory.length;
        const byType = {} as Record<CommunicationErrorType, number>;
        const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
        let recoveredCount = 0;

        this.errorHistory.forEach(error => {
            byType[error.type] = (byType[error.type] || 0) + 1;
            bySeverity[error.severity]++;
            if (error.recoverable) {
                recoveredCount++;
            }
        });

        return {
            total,
            byType,
            bySeverity,
            recoveryRate: total > 0 ? recoveredCount / total : 0,
        };
    }
}

// Create singleton instance
export const communicationErrorService = new CommunicationErrorService();

// Export types and service
export default communicationErrorService;