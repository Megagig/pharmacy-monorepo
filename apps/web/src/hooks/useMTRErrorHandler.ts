import { useCallback } from 'react';
import { analyzeMTRError, handleMTRErrorInDev, type MTRError } from '../utils/mtrErrorHandler';

/**
 * Hook for handling MTR errors consistently across components
 */
export const useMTRErrorHandler = () => {
    const handleError = useCallback((error: unknown, context: string): MTRError => {
        // Log detailed error info in development
        handleMTRErrorInDev(error, context);

        // Return analyzed error for UI handling
        return analyzeMTRError(error);
    }, []);

    const getErrorMessage = useCallback((error: unknown): string => {
        const analyzed = analyzeMTRError(error);
        return analyzed.userMessage;
    }, []);

    const getErrorAction = useCallback((error: unknown): string | undefined => {
        const analyzed = analyzeMTRError(error);
        return analyzed.suggestedAction;
    }, []);

    const isActionable = useCallback((error: unknown): boolean => {
        const analyzed = analyzeMTRError(error);
        return analyzed.actionable;
    }, []);

    return {
        handleError,
        getErrorMessage,
        getErrorAction,
        isActionable,
    };
};