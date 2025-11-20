import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  errorHandlingService,
  AppError,
} from '../services/errorHandlingService';

// Enhanced error types specific to clinical notes
export interface ClinicalNoteError extends AppError {
  context: 'clinical-notes';
  operation?:
    | 'create'
    | 'update'
    | 'delete'
    | 'fetch'
    | 'search'
    | 'upload'
    | 'sync';
  noteId?: string;
  patientId?: string;
  retryable?: boolean;
}

export interface ErrorRecoveryOptions {
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  showToast?: boolean;
  onRetry?: () => Promise<void>;
  onMaxRetriesReached?: (error: ClinicalNoteError) => void;
}

export interface DuplicateSubmissionPrevention {
  isSubmitting: boolean;
  lastSubmissionTime: number | null;
  preventDuplicateSubmission: (
    operation: () => Promise<any>,
    minInterval?: number
  ) => Promise<any>;
}

// Hook for comprehensive clinical notes error handling
export const useClinicalNotesErrorHandling = () => {
  const [errors, setErrors] = useState<Map<string, ClinicalNoteError>>(
    new Map()
  );
  const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(
    new Map()
  );
  const [isRecovering, setIsRecovering] = useState<Set<string>>(new Set());

  // Handle clinical notes specific errors
  const handleError = useCallback(
    (
      error: any,
      operation: ClinicalNoteError['operation'],
      context: {
        noteId?: string;
        patientId?: string;
        field?: string;
      } = {},
      options: ErrorRecoveryOptions = {}
    ): ClinicalNoteError => {
      const {
        autoRetry = false,
        maxRetries = 3,
        retryDelay = 1000,
        showToast = true,
        onRetry,
        onMaxRetriesReached,
      } = options;

      // Create enhanced error object
      const clinicalNoteError: ClinicalNoteError = {
        ...errorHandlingService.handleError(
          error,
          `clinical-notes-${operation}`,
          {
            showToast: false, // We'll handle toast ourselves
            logError: true,
            trackMetrics: true,
            autoRetry: false, // We'll handle retry ourselves
          }
        ),
        context: 'clinical-notes',
        operation,
        noteId: context.noteId,
        patientId: context.patientId,
        retryable: isRetryableError(error, operation),
      };

      // Generate error key for tracking
      const errorKey = `${operation}-${
        context.noteId || context.patientId || 'global'
      }-${Date.now()}`;

      // Store error
      setErrors((prev) => new Map(prev).set(errorKey, clinicalNoteError));

      // Show user-friendly toast notification
      if (showToast) {
        showErrorToast(clinicalNoteError);
      }

      // Handle auto-retry if enabled and error is retryable
      if (autoRetry && clinicalNoteError.retryable && onRetry) {
        const currentAttempts = retryAttempts.get(errorKey) || 0;

        if (currentAttempts < maxRetries) {
          scheduleRetry(
            errorKey,
            onRetry,
            currentAttempts,
            retryDelay,
            maxRetries,
            onMaxRetriesReached
          );
        } else if (onMaxRetriesReached) {
          onMaxRetriesReached(clinicalNoteError);
        }
      }

      return clinicalNoteError;
    },
    [retryAttempts]
  );

  // Determine if error is retryable
  const isRetryableError = (error: any, operation?: string): boolean => {
    // Network errors are generally retryable
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.response?.status >= 500) {
      return true;
    }

    // Timeout errors are retryable
    if (error.code === 'ECONNABORTED') {
      return true;
    }

    // Some operations are not retryable
    if (operation === 'delete' && error.response?.status === 404) {
      return false; // Already deleted
    }

    // Validation errors are not retryable
    if (error.response?.status === 400 || error.response?.status === 422) {
      return false;
    }

    // Permission errors are not retryable
    if (error.response?.status === 401 || error.response?.status === 403) {
      return false;
    }

    return false;
  };

  // Schedule retry with exponential backoff
  const scheduleRetry = useCallback(
    (
      errorKey: string,
      retryFunction: () => Promise<void>,
      currentAttempts: number,
      baseDelay: number,
      maxRetries: number,
      onMaxRetriesReached?: (error: ClinicalNoteError) => void
    ) => {
      const delay = baseDelay * Math.pow(2, currentAttempts); // Exponential backoff

      setRetryAttempts((prev) =>
        new Map(prev).set(errorKey, currentAttempts + 1)
      );
      setIsRecovering((prev) => new Set(prev).add(errorKey));

      setTimeout(async () => {
        try {
          await retryFunction();

          // Success - clear error and retry attempts
          setErrors((prev) => {
            const newErrors = new Map(prev);
            newErrors.delete(errorKey);
            return newErrors;
          });

          setRetryAttempts((prev) => {
            const newAttempts = new Map(prev);
            newAttempts.delete(errorKey);
            return newAttempts;
          });

          toast.success('Operation completed successfully after retry');
        } catch (retryError) {
          const newAttempts = currentAttempts + 1;

          if (newAttempts >= maxRetries) {
            // Max retries reached
            const originalError = errors.get(errorKey);
            if (originalError && onMaxRetriesReached) {
              onMaxRetriesReached(originalError);
            }

            toast.error(
              `Failed after ${maxRetries} attempts. Please try again manually.`
            );
          } else {
            // Schedule another retry
            scheduleRetry(
              errorKey,
              retryFunction,
              newAttempts,
              baseDelay,
              maxRetries,
              onMaxRetriesReached
            );
          }
        } finally {
          setIsRecovering((prev) => {
            const newRecovering = new Set(prev);
            newRecovering.delete(errorKey);
            return newRecovering;
          });
        }
      }, delay);
    },
    [errors]
  );

  // Show user-friendly error toast
  const showErrorToast = (error: ClinicalNoteError) => {
    const getMessage = () => {
      switch (error.operation) {
        case 'create':
          return 'Failed to create clinical note. Please check your input and try again.';
        case 'update':
          return 'Failed to update clinical note. Your changes may not have been saved.';
        case 'delete':
          return 'Failed to delete clinical note. Please try again.';
        case 'fetch':
          return 'Failed to load clinical notes. Please refresh the page.';
        case 'search':
          return 'Search failed. Please try with different criteria.';
        case 'upload':
          return 'File upload failed. Please check the file and try again.';
        case 'sync':
          return 'Sync failed. Changes will be retried when connection is restored.';
        default:
          return error.message || 'An error occurred with clinical notes.';
      }
    };

    // Show toast notification based on severity
    const toastOptions = {
      duration: error.severity === 'critical' ? 10000 : 5000,
    };

    switch (error.severity) {
      case 'critical':
      case 'high':
        toast.error(getMessage(), toastOptions);
        break;
      case 'medium':
        toast(getMessage(), {
          ...toastOptions,
          icon: '⚠️',
        });
        break;
      case 'low':
        toast(getMessage(), {
          ...toastOptions,
          icon: 'ℹ️',
        });
        break;
    }
  };

  // Manual retry function
  const retryOperation = useCallback(
    async (errorKey: string, retryFunction: () => Promise<void>) => {
      const error = errors.get(errorKey);
      if (!error) return;

      setIsRecovering((prev) => new Set(prev).add(errorKey));

      try {
        await retryFunction();

        // Success - clear error
        setErrors((prev) => {
          const newErrors = new Map(prev);
          newErrors.delete(errorKey);
          return newErrors;
        });

        toast.success('Operation completed successfully');
      } catch (retryError) {
        // Update error with new attempt
        const updatedError = {
          ...error,
          timestamp: new Date().toISOString(),
          details: {
            ...error.details,
            retryAttempt: (retryAttempts.get(errorKey) || 0) + 1,
          },
        };

        setErrors((prev) => new Map(prev).set(errorKey, updatedError));
        showErrorToast(updatedError);
      } finally {
        setIsRecovering((prev) => {
          const newRecovering = new Set(prev);
          newRecovering.delete(errorKey);
          return newRecovering;
        });
      }
    },
    [errors, retryAttempts]
  );

  // Clear specific error
  const clearError = useCallback((errorKey: string) => {
    setErrors((prev) => {
      const newErrors = new Map(prev);
      newErrors.delete(errorKey);
      return newErrors;
    });

    setRetryAttempts((prev) => {
      const newAttempts = new Map(prev);
      newAttempts.delete(errorKey);
      return newAttempts;
    });
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors(new Map());
    setRetryAttempts(new Map());
    setIsRecovering(new Set());
  }, []);

  // Get errors for specific operation or context
  const getErrors = useCallback(
    (filter?: {
      operation?: ClinicalNoteError['operation'];
      noteId?: string;
      patientId?: string;
    }) => {
      const allErrors = Array.from(errors.values());

      if (!filter) return allErrors;

      return allErrors.filter((error) => {
        if (filter.operation && error.operation !== filter.operation)
          return false;
        if (filter.noteId && error.noteId !== filter.noteId) return false;
        if (filter.patientId && error.patientId !== filter.patientId)
          return false;
        return true;
      });
    },
    [errors]
  );

  // Check if operation is currently recovering
  const isOperationRecovering = useCallback(
    (errorKey: string) => {
      return isRecovering.has(errorKey);
    },
    [isRecovering]
  );

  return {
    handleError,
    retryOperation,
    clearError,
    clearAllErrors,
    getErrors,
    isOperationRecovering,
    hasErrors: errors.size > 0,
    errorCount: errors.size,
  };
};

// Hook for preventing duplicate submissions
export const useDuplicateSubmissionPrevention =
  (): DuplicateSubmissionPrevention => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSubmissionTime, setLastSubmissionTime] = useState<number | null>(
      null
    );
    const submissionRef = useRef<Promise<any> | null>(null);

    const preventDuplicateSubmission = useCallback(
      async (
        operation: () => Promise<any>,
        minInterval: number = 1000 // Minimum 1 second between submissions
      ): Promise<any> => {
        const now = Date.now();

        // Check if we're already submitting
        if (isSubmitting) {
          throw new Error('Operation already in progress. Please wait.');
        }

        // Check minimum interval
        if (lastSubmissionTime && now - lastSubmissionTime < minInterval) {
          throw new Error(
            `Please wait ${Math.ceil(
              (minInterval - (now - lastSubmissionTime)) / 1000
            )} seconds before trying again.`
          );
        }

        // Check if there's an ongoing submission
        if (submissionRef.current) {
          throw new Error('Another operation is in progress. Please wait.');
        }

        setIsSubmitting(true);
        setLastSubmissionTime(now);

        try {
          const submissionPromise = operation();
          submissionRef.current = submissionPromise;

          const result = await submissionPromise;
          return result;
        } finally {
          setIsSubmitting(false);
          submissionRef.current = null;
        }
      },
      [isSubmitting, lastSubmissionTime]
    );

    return {
      isSubmitting,
      lastSubmissionTime,
      preventDuplicateSubmission,
    };
  };

// Hook for form validation with real-time feedback
export const useFormValidationFeedback = () => {
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    new Map()
  );
  const [isValidating, setIsValidating] = useState(false);
  const validationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const validateField = useCallback(
    (
      fieldName: string,
      value: any,
      validator: (value: any) => string | null,
      debounceMs: number = 300
    ) => {
      // Clear existing timeout for this field
      const existingTimeout = validationTimeouts.current.get(fieldName);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout for validation
      const timeout = setTimeout(() => {
        setIsValidating(true);

        try {
          const error = validator(value);

          setValidationErrors((prev) => {
            const newErrors = new Map(prev);
            if (error) {
              newErrors.set(fieldName, error);
            } else {
              newErrors.delete(fieldName);
            }
            return newErrors;
          });
        } catch (validationError) {
          console.error(
            `Validation error for field ${fieldName}:`,
            validationError
          );
        } finally {
          setIsValidating(false);
        }
      }, debounceMs);

      validationTimeouts.current.set(fieldName, timeout);
    },
    []
  );

  const clearFieldValidation = useCallback((fieldName: string) => {
    setValidationErrors((prev) => {
      const newErrors = new Map(prev);
      newErrors.delete(fieldName);
      return newErrors;
    });

    const timeout = validationTimeouts.current.get(fieldName);
    if (timeout) {
      clearTimeout(timeout);
      validationTimeouts.current.delete(fieldName);
    }
  }, []);

  const clearAllValidation = useCallback(() => {
    setValidationErrors(new Map());

    // Clear all timeouts
    validationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    validationTimeouts.current.clear();
  }, []);

  const getFieldError = useCallback(
    (fieldName: string) => {
      return validationErrors.get(fieldName) || null;
    },
    [validationErrors]
  );

  const hasErrors = validationErrors.size > 0;
  const hasFieldError = useCallback(
    (fieldName: string) => {
      return validationErrors.has(fieldName);
    },
    [validationErrors]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      validationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return {
    validateField,
    clearFieldValidation,
    clearAllValidation,
    getFieldError,
    hasFieldError,
    hasErrors,
    isValidating,
    errorCount: validationErrors.size,
  };
};

export default {
  useClinicalNotesErrorHandling,
  useDuplicateSubmissionPrevention,
  useFormValidationFeedback,
};
