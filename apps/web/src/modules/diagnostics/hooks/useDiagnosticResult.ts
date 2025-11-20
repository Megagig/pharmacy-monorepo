import { useQuery } from '@tanstack/react-query';
import { diagnosticApi } from '../api/diagnosticApi';
import { diagnosticQueryKeys } from './useDiagnostics';

/**
 * Hook to fetch diagnostic result by request ID with automatic polling
 */
export const useDiagnosticResult = (requestId: string, options?: {
    enablePolling?: boolean;
    pollingInterval?: number;
}) => {
    const { enablePolling = false, pollingInterval = 5000 } = options || {};

    return useQuery({
        queryKey: diagnosticQueryKeys.result(requestId),
        queryFn: () => diagnosticApi.getResult(requestId),
        enabled: !!requestId,
        staleTime: 30 * 1000, // 30 seconds for results
        refetchInterval: enablePolling ? pollingInterval : false,
        refetchIntervalInBackground: enablePolling,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
            // Don't retry if result is not found (404) - it might not be ready yet
            if (error?.response?.status === 404) {
                return failureCount < 10; // Keep trying for up to 10 attempts
            }
            return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
};

export default useDiagnosticResult;