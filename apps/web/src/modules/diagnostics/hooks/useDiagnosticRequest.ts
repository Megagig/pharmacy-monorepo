import { useQuery } from '@tanstack/react-query';
import { diagnosticApi } from '../api/diagnosticApi';
import { diagnosticQueryKeys } from './useDiagnostics';

/**
 * Hook to fetch a single diagnostic request by ID
 */
export const useDiagnosticRequest = (requestId: string) => {
    return useQuery({
        queryKey: diagnosticQueryKeys.request(requestId),
        queryFn: () => diagnosticApi.getRequest(requestId),
        enabled: !!requestId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

export default useDiagnosticRequest;