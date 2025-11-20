import { useQuery } from '@tanstack/react-query';
import { interactionApi } from '../api/interactionApi';
import { interactionQueryKeys } from './useInteractions';

/**
 * Hook to check allergy contraindications
 */
export const useAllergyCheck = (medications: string[], allergies: string[]) => {
    return useQuery({
        queryKey: interactionQueryKeys.allergies(medications, allergies),
        queryFn: () => interactionApi.checkAllergies({ medications, allergies }),
        enabled: medications.length > 0 && allergies.length > 0,
        staleTime: 10 * 60 * 1000, // 10 minutes for allergy checks
        refetchOnWindowFocus: false,
    });
};

export default useAllergyCheck;