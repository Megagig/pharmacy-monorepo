/**
 * MTR Error Handler Utility
 * Provides consistent error handling and user-friendly messages for MTR operations
 */

export interface MTRError {
    type: 'permission' | 'authentication' | 'network' | 'validation' | 'server' | 'unknown';
    message: string;
    userMessage: string;
    actionable: boolean;
    suggestedAction?: string;
}

/**
 * Analyzes an error and returns structured error information
 */
export const analyzeMTRError = (error: unknown): MTRError => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Permission errors
    if (errorMessage.includes('Permission denied') || errorMessage.includes('403')) {
        return {
            type: 'permission',
            message: errorMessage,
            userMessage: 'You do not have permission to perform this action.',
            actionable: true,
            suggestedAction: 'Please contact your administrator to request MTR access permissions.'
        };
    }

    // Authentication errors
    if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        return {
            type: 'authentication',
            message: errorMessage,
            userMessage: 'Authentication required to access MTR features.',
            actionable: true,
            suggestedAction: 'Please log in to continue using MTR features.'
        };
    }

    // Network errors
    if (errorMessage.includes('Network Error') || errorMessage.includes('fetch')) {
        return {
            type: 'network',
            message: errorMessage,
            userMessage: 'Unable to connect to the server.',
            actionable: true,
            suggestedAction: 'Please check your internet connection and try again.'
        };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('required')) {
        return {
            type: 'validation',
            message: errorMessage,
            userMessage: 'Please check that all required fields are completed correctly.',
            actionable: true,
            suggestedAction: 'Review the form and complete any missing or invalid information.'
        };
    }

    // Server errors
    if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        return {
            type: 'server',
            message: errorMessage,
            userMessage: 'A server error occurred while processing your request.',
            actionable: false,
            suggestedAction: 'Please try again later or contact support if the problem persists.'
        };
    }

    // Unknown errors
    return {
        type: 'unknown',
        message: errorMessage,
        userMessage: 'An unexpected error occurred.',
        actionable: false,
        suggestedAction: 'Please try again or contact support if the problem persists.'
    };
};

/**
 * Gets a user-friendly error message for display in the UI
 */
export const getMTRErrorMessage = (error: unknown): string => {
    const analyzedError = analyzeMTRError(error);
    return analyzedError.userMessage;
};

/**
 * Gets a suggested action for the user based on the error
 */
export const getMTRErrorAction = (error: unknown): string | undefined => {
    const analyzedError = analyzeMTRError(error);
    return analyzedError.suggestedAction;
};

/**
 * Determines if an error is actionable by the user
 */
export const isMTRErrorActionable = (error: unknown): boolean => {
    const analyzedError = analyzeMTRError(error);
    return analyzedError.actionable;
};

/**
 * Development mode error handler - provides more detailed information
 */
export const handleMTRErrorInDev = (error: unknown, context: string): void => {
    if (import.meta.env.DEV) {
        const analyzedError = analyzeMTRError(error);
        console.group(`🔍 MTR Error in ${context}`);
        console.error('Original Error:', error);



        if (analyzedError.suggestedAction) {

        }
        console.groupEnd();
    }
};