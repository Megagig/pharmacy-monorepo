import { useState, useCallback, useEffect } from 'react';

// Define comprehensive error type to replace any
export interface AppError {
  message?: string;
  code?: string | number;
  response?: {
    status?: number;
    data?: {
      message?: string;
      code?: string;
    };
  };
  isAxiosError?: boolean;
  stack?: string;
  name?: string;
}

export type ErrorInput = string | Error | AppError | unknown;

export interface ErrorState {
  error: Error | null;
  message: string | null;
  code: string | null;
  type:
    | 'network'
    | 'server'
    | 'validation'
    | 'permission'
    | 'notFound'
    | 'unknown';
  timestamp: Date | null;
}

export interface LoadingState {
  [key: string]: boolean;
}

/**
 * Enhanced error handling hook with error classification and retry logic
 */
export const useErrorHandler = () => {
  const [errors, setErrors] = useState<{ [key: string]: ErrorState }>({});

  const classifyError = useCallback((error: ErrorInput): ErrorState['type'] => {
    if (!error) return 'unknown';

    // Network errors
    if (
      (error as AppError).code === 'NETWORK_ERROR' ||
      (error as AppError).message === 'Network Error'
    ) {
      return 'network';
    }

    // Axios errors
    if ((error as AppError).isAxiosError || (error as AppError).response) {
      const status = (error as AppError).response?.status;

      switch (status) {
        case 400:
        case 422:
          return 'validation';
        case 401:
        case 403:
          return 'permission';
        case 404:
          return 'notFound';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'server';
        default:
          return 'unknown';
      }
    }

    return 'unknown';
  }, []);

  const setError = useCallback(
    (key: string, error: ErrorInput) => {
      if (!error) {
        setErrors((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _, ...rest } = prev;
          return rest;
        });
        return;
      }

      const errorState: ErrorState = {
        error: error instanceof Error ? error : new Error(String(error)),
        message:
          (error as AppError)?.response?.data?.message ||
          (error as AppError)?.message ||
          String(error),
        code: String(
          (error as AppError)?.response?.data?.code ||
            (error as AppError)?.code ||
            ''
        ),
        type: classifyError(error),
        timestamp: new Date(),
      };

      setErrors((prev) => ({
        ...prev,
        [key]: errorState,
      }));

      // Log error for debugging
      console.error(`Error in ${key}:`, errorState);
    },
    [classifyError]
  );

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasError = useCallback(
    (key?: string) => {
      if (key) return !!errors[key];
      return Object.keys(errors).length > 0;
    },
    [errors]
  );

  const getError = useCallback(
    (key: string) => {
      return errors[key] || null;
    },
    [errors]
  );

  const getAllErrors = useCallback(() => {
    return errors;
  }, [errors]);

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
    hasError,
    getError,
    getAllErrors,
  };
};

/**
 * Enhanced loading state management hook
 */
export const useLoadingState = () => {
  const [loading, setLoading] = useState<LoadingState>({});

  const setLoadingState = useCallback((key: string, isLoading: boolean) => {
    setLoading((prev) => ({
      ...prev,
      [key]: isLoading,
    }));
  }, []);

  const clearLoadingState = useCallback((key: string) => {
    setLoading((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllLoading = useCallback(() => {
    setLoading({});
  }, []);

  const isLoading = useCallback(
    (key?: string) => {
      if (key) return !!loading[key];
      return Object.values(loading).some(Boolean);
    },
    [loading]
  );

  const getLoadingKeys = useCallback(() => {
    return Object.keys(loading).filter((key) => loading[key]);
  }, [loading]);

  return {
    loading,
    setLoadingState,
    clearLoadingState,
    clearAllLoading,
    isLoading,
    getLoadingKeys,
  };
};

/**
 * Combined async operation hook with error handling and loading states
 */
export const useAsyncOperation = () => {
  const { setError, clearError, getError } = useErrorHandler();
  const { setLoadingState, isLoading } = useLoadingState();

  const executeOperation = useCallback(
    async <T>(
      key: string,
      operation: () => Promise<T>,
      options: {
        onSuccess?: (result: T) => void;
        onError?: (error: ErrorInput) => void;
        clearErrorOnStart?: boolean;
        // showNotification parameter is defined but not used in current implementation
      } = {}
    ): Promise<T | null> => {
      const {
        onSuccess,
        onError,
        clearErrorOnStart = true,
        // showNotification parameter is defined but not used in current implementation
      } = options;

      try {
        if (clearErrorOnStart) {
          clearError(key);
        }

        setLoadingState(key, true);
        const result = await operation();

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        setError(key, error);

        if (onError) {
          onError(error);
        }

        return null;
      } finally {
        setLoadingState(key, false);
      }
    },
    [setError, clearError, setLoadingState]
  );

  return {
    executeOperation,
    isLoading,
    getError,
  };
};

/**
 * Retry logic hook with exponential backoff
 */
export const useRetryLogic = () => {
  const [retryCount, setRetryCount] = useState<{ [key: string]: number }>({});

  const retry = useCallback(
    async <T>(
      key: string,
      operation: () => Promise<T>,
      options: {
        maxRetries?: number;
        initialDelay?: number;
        backoffFactor?: number;
        onRetry?: (attempt: number) => void;
      } = {}
    ): Promise<T | null> => {
      const {
        maxRetries = 3,
        initialDelay = 1000,
        backoffFactor = 2,
        onRetry,
      } = options;

      const currentRetries = retryCount[key] || 0;

      if (currentRetries >= maxRetries) {
        throw new Error(
          `Maximum retry attempts (${maxRetries}) exceeded for ${key}`
        );
      }

      try {
        const result = await operation();
        // Success - reset retry count
        setRetryCount((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _, ...rest } = prev;
          return rest;
        });
        return result;
      } catch (error) {
        const nextRetryCount = currentRetries + 1;
        setRetryCount((prev) => ({
          ...prev,
          [key]: nextRetryCount,
        }));

        if (nextRetryCount < maxRetries) {
          const delay = initialDelay * Math.pow(backoffFactor, currentRetries);

          if (onRetry) {
            onRetry(nextRetryCount);
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          return retry(key, operation, options);
        }

        throw error;
      }
    },
    [retryCount]
  );

  const resetRetryCount = useCallback((key: string) => {
    setRetryCount((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const getRetryCount = useCallback(
    (key: string) => {
      return retryCount[key] || 0;
    },
    [retryCount]
  );

  return {
    retry,
    resetRetryCount,
    getRetryCount,
    retryCount,
  };
};

/**
 * Data fetching hook with comprehensive error handling and loading states
 */
export const useDataFetch = <T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    retryOnError?: boolean;
    maxRetries?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { executeOperation, isLoading, getError } = useAsyncOperation();
  const { retry, getRetryCount } = useRetryLogic();

  const {
    enabled = true,
    refetchOnMount = true,
    retryOnError = false,
    maxRetries = 3,
    onSuccess,
    onError,
  } = options;

  const fetchData = useCallback(
    async (force = false) => {
      if (!enabled && !force) return;

      const operation = retryOnError
        ? () =>
            retry(key, fetchFunction, {
              maxRetries,
              onRetry: (attempt) => {

              },
            })
        : fetchFunction;

      const result = await executeOperation(key, operation, {
        onSuccess: (data) => {
          setData(data);
          setIsInitialized(true);
          if (onSuccess && data !== null) onSuccess(data);
        },
        onError,
      });

      return result;
    },
    [
      enabled,
      executeOperation,
      fetchFunction,
      key,
      maxRetries,
      onError,
      onSuccess,
      retry,
      retryOnError,
    ]
  );

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (enabled && (refetchOnMount || !isInitialized)) {
      fetchData();
    }
  }, [enabled, refetchOnMount, isInitialized, fetchData]);

  return {
    data,
    isLoading: isLoading(key),
    error: getError(key),
    refetch,
    retryCount: getRetryCount(key),
    isInitialized,
  };
};

/**
 * Form submission hook with error handling
 */
export const useFormSubmission = <T, R = unknown>(
  key: string,
  submitFunction: (data: T) => Promise<R>
) => {
  const { executeOperation, isLoading, getError } = useAsyncOperation();

  const submit = useCallback(
    async (
      data: T,
      options: {
        onSuccess?: (result: R) => void;
        onError?: (error: unknown) => void;
        validateBeforeSubmit?: (data: T) => string | null;
      } = {}
    ) => {
      const { onSuccess, onError, validateBeforeSubmit } = options;

      // Pre-submission validation
      if (validateBeforeSubmit) {
        const validationError = validateBeforeSubmit(data);
        if (validationError) {
          throw new Error(validationError);
        }
      }

      return executeOperation(key, () => submitFunction(data), {
        onSuccess,
        onError,
      });
    },
    [executeOperation, key, submitFunction]
  );

  return {
    submit,
    isSubmitting: isLoading(key),
    error: getError(key),
  };
};

export default {
  useErrorHandler,
  useLoadingState,
  useAsyncOperation,
  useRetryLogic,
  useDataFetch,
  useFormSubmission,
};
