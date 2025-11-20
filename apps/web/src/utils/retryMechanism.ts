import React from 'react';
import { errorHandlingService } from '../services/errorHandlingService';

// Retry configuration interface
export interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryCondition?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any) => void;
    onMaxRetriesReached?: (error: any) => void;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error) => {
        // Retry on network errors, server errors, and timeouts
        return (
            !error.response ||
            error.code === 'NETWORK_ERROR' ||
            error.code === 'ECONNABORTED' ||
            (error.response?.status >= 500 && error.response?.status < 600) ||
            error.response?.status === 408 || // Request timeout
            error.response?.status === 429    // Rate limited
        );
    }
};

// Retry mechanism class
export class RetryMechanism {
    private static instance: RetryMechanism;
    private activeRetries: Map<string, AbortController> = new Map();

    static getInstance(): RetryMechanism {
        if (!RetryMechanism.instance) {
            RetryMechanism.instance = new RetryMechanism();
        }
        return RetryMechanism.instance;
    }

    // Execute operation with retry logic
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationId: string,
        config: Partial<RetryConfig> = {}
    ): Promise<T> {
        const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
        let lastError: any;
        let attempt = 0;

        // Create abort controller for this operation
        const abortController = new AbortController();
        this.activeRetries.set(operationId, abortController);

        try {
            while (attempt < finalConfig.maxAttempts) {
                // Check if operation was cancelled
                if (abortController.signal.aborted) {
                    throw new Error('Operation cancelled');
                }

                attempt++;

                try {
                    const result = await operation();

                    // Success - clean up and return
                    this.activeRetries.delete(operationId);
                    return result;
                } catch (error) {
                    lastError = error;

                    // Log the error
                    console.warn(`Attempt ${attempt} failed for ${operationId}:`, error);

                    // Check if we should retry
                    if (
                        attempt >= finalConfig.maxAttempts ||
                        !finalConfig.retryCondition?.(error)
                    ) {
                        break;
                    }

                    // Call retry callback
                    if (finalConfig.onRetry) {
                        finalConfig.onRetry(attempt, error);
                    }

                    // Calculate delay with exponential backoff
                    const delay = Math.min(
                        finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
                        finalConfig.maxDelay
                    );

                    // Add jitter to prevent thundering herd
                    const jitteredDelay = delay + Math.random() * 1000;

                    // Wait before retry
                    await this.delay(jitteredDelay, abortController.signal);
                }
            }

            // Max retries reached
            this.activeRetries.delete(operationId);

            if (finalConfig.onMaxRetriesReached) {
                finalConfig.onMaxRetriesReached(lastError);
            }

            throw lastError;
        } catch (error) {
            this.activeRetries.delete(operationId);
            throw error;
        }
    }

    // Cancel a specific retry operation
    cancelRetry(operationId: string): void {
        const abortController = this.activeRetries.get(operationId);
        if (abortController) {
            abortController.abort();
            this.activeRetries.delete(operationId);
        }
    }

    // Cancel all active retries
    cancelAllRetries(): void {
        for (const [operationId, abortController] of this.activeRetries) {
            abortController.abort();
        }
        this.activeRetries.clear();
    }

    // Get active retry operations
    getActiveRetries(): string[] {
        return Array.from(this.activeRetries.keys());
    }

    // Delay with cancellation support
    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(resolve, ms);

            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Operation cancelled'));
                });
            }
        });
    }
}

// Singleton instance
export const retryMechanism = RetryMechanism.getInstance();

// Utility functions for common retry scenarios
export const retryApiCall = async <T>(
    apiCall: () => Promise<T>,
    operationName: string,
    customConfig?: Partial<RetryConfig>
): Promise<T> => {
    const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        initialDelay: 1000,
        onRetry: (attempt, error) => {

            // Handle error through error service
            errorHandlingService.handleError(error, `retry_${operationName}`, {
                showToast: false,
                logError: true,
                trackMetrics: true
            });
        },
        onMaxRetriesReached: (error) => {
            console.error(`Max retries reached for ${operationName}:`, error);

            // Handle final error
            errorHandlingService.handleError(error, `max_retries_${operationName}`, {
                showToast: true,
                logError: true,
                trackMetrics: true
            });
        },
        ...customConfig
    };

    return retryMechanism.executeWithRetry(apiCall, operationName, config);
};

export const retryNetworkOperation = async <T>(
    operation: () => Promise<T>,
    operationName: string
): Promise<T> => {
    return retryApiCall(operation, operationName, {
        maxAttempts: 5,
        initialDelay: 2000,
        maxDelay: 30000,
        retryCondition: (error) => {
            // More aggressive retry for network operations
            return (
                !error.response ||
                error.code === 'NETWORK_ERROR' ||
                error.code === 'ECONNABORTED' ||
                error.message === 'Network Error' ||
                (error.response?.status >= 500) ||
                error.response?.status === 408 ||
                error.response?.status === 429 ||
                error.response?.status === 502 ||
                error.response?.status === 503 ||
                error.response?.status === 504
            );
        }
    });
};

export const retryFormSubmission = async <T>(
    submitFunction: () => Promise<T>,
    formName: string
): Promise<T> => {
    return retryApiCall(submitFunction, `form_${formName}`, {
        maxAttempts: 2, // Less aggressive for form submissions
        initialDelay: 1500,
        retryCondition: (error) => {
            // Only retry on server errors, not validation errors
            return (
                !error.response ||
                (error.response?.status >= 500) ||
                error.response?.status === 408 ||
                error.code === 'NETWORK_ERROR'
            );
        }
    });
};

// React hook for retry functionality
export const useRetry = () => {
    const [activeRetries, setActiveRetries] = React.useState<string[]>([]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setActiveRetries(retryMechanism.getActiveRetries());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const executeWithRetry = React.useCallback(
        <T>(
            operation: () => Promise<T>,
            operationId: string,
            config?: Partial<RetryConfig>
        ) => {
            return retryMechanism.executeWithRetry(operation, operationId, config);
        },
        []
    );

    const cancelRetry = React.useCallback((operationId: string) => {
        retryMechanism.cancelRetry(operationId);
    }, []);

    const cancelAllRetries = React.useCallback(() => {
        retryMechanism.cancelAllRetries();
    }, []);

    return {
        executeWithRetry,
        cancelRetry,
        cancelAllRetries,
        activeRetries,
        hasActiveRetries: activeRetries.length > 0
    };
};

export default {
    RetryMechanism,
    retryMechanism,
    retryApiCall,
    retryNetworkOperation,
    retryFormSubmission,
    useRetry,
    DEFAULT_RETRY_CONFIG
};