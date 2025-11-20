import { useQuery } from '@tanstack/react-query';
import { interactionApi } from '../api/interactionApi';
import { interactionQueryKeys } from './useInteractions';

/**
 * Hook to get drug information for medication lookup
 */
export const useDrugInfo = (drugName: string) => {
    return useQuery({
        queryKey: interactionQueryKeys.drugInfo(drugName),
        queryFn: () => interactionApi.getDrugInfo(drugName),
        enabled: !!drugName && drugName.length >= 2,
        staleTime: 30 * 60 * 1000, // 30 minutes for drug info
        refetchOnWindowFocus: false,
    });
};

export default useDrugInfo;