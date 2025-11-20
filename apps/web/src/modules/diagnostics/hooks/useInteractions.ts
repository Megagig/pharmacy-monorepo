import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interactionApi } from '../api/interactionApi';
import { useUIStore } from '../../../stores';
import type {
    DrugInteraction,
    AllergyAlert,
    Contraindication,
    ApiResponse
} from '../types';
import React from 'react';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// Interaction check result type
interface InteractionCheckResult {
    interactions: DrugInteraction[];
    allergicReactions: AllergyAlert[];
    contraindications: Contraindication[];
}

// Query keys for interactions
export const interactionQueryKeys = {
    all: ['interactions'] as const,
    check: (medications: string[], allergies?: string[]) =>
        ['interactions', 'check', { medications, allergies }] as const,
    drugInfo: (drugName: string) => ['interactions', 'drug-info', drugName] as const,
    search: (query: string, limit?: number) => ['interactions', 'search', query, limit] as const,
    allergies: (medications: string[], allergies: string[]) =>
        ['interactions', 'allergies', { medications, allergies }] as const,
    details: (drug1: string, drug2: string) =>
        ['interactions', 'details', drug1, drug2] as const,
    classInteractions: (drugClass: string) =>
        ['interactions', 'class', drugClass] as const,
    foodInteractions: (drugName: string) =>
        ['interactions', 'food', drugName] as const,
    pregnancyInfo: (drugName: string) =>
        ['interactions', 'pregnancy', drugName] as const,
};

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to check drug interactions with debounced input
 */
export const useCheckInteractions = (
    medications: string[],
    patientAllergies?: string[],
    options?: {
        enabled?: boolean;
        debounceMs?: number;
    }
) => {
    const { enabled = true, debounceMs = 500 } = options || {};
    const [debouncedMedications, setDebouncedMedications] = React.useState(medications);
    const [debouncedAllergies, setDebouncedAllergies] = React.useState(patientAllergies);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedMedications(medications);
            setDebouncedAllergies(patientAllergies);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [medications, patientAllergies, debounceMs]);

    return useQuery({
        queryKey: interactionQueryKeys.check(debouncedMedications, debouncedAllergies),
        queryFn: () => interactionApi.checkInteractions({
            medications: debouncedMedications,
            patientAllergies: debouncedAllergies,
        }),
        enabled: enabled && debouncedMedications.length >= 2, // Need at least 2 medications
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
            // Don't retry for client errors (4xx)
            if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
            }
            return failureCount < 3;
        },
    });
};

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

/**
 * Hook to search drugs with debounced input
 */
export const useSearchDrugs = (query: string, limit: number = 10, debounceMs: number = 300) => {
    const [debouncedQuery, setDebouncedQuery] = React.useState(query);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [query, debounceMs]);

    return useQuery({
        queryKey: interactionQueryKeys.search(debouncedQuery, limit),
        queryFn: () => interactionApi.searchDrugs(debouncedQuery, limit),
        enabled: debouncedQuery.length >= 2, // Only search with 2+ characters
        staleTime: 10 * 60 * 1000, // 10 minutes for search results
        refetchOnWindowFocus: false,
    });
};

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

/**
 * Hook to get detailed interaction information
 */
export const useInteractionDetails = (drug1: string, drug2: string) => {
    return useQuery({
        queryKey: interactionQueryKeys.details(drug1, drug2),
        queryFn: () => interactionApi.getInteractionDetails(drug1, drug2),
        enabled: !!drug1 && !!drug2,
        staleTime: 60 * 60 * 1000, // 1 hour for interaction details
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to get drug class interactions
 */
export const useClassInteractions = (drugClass: string) => {
    return useQuery({
        queryKey: interactionQueryKeys.classInteractions(drugClass),
        queryFn: () => interactionApi.getClassInteractions(drugClass),
        enabled: !!drugClass,
        staleTime: 60 * 60 * 1000, // 1 hour for class interactions
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to get food interactions
 */
export const useFoodInteractions = (drugName: string) => {
    return useQuery({
        queryKey: interactionQueryKeys.foodInteractions(drugName),
        queryFn: () => interactionApi.getFoodInteractions(drugName),
        enabled: !!drugName,
        staleTime: 60 * 60 * 1000, // 1 hour for food interactions
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to get pregnancy and lactation information
 */
export const usePregnancyInfo = (drugName: string) => {
    return useQuery({
        queryKey: interactionQueryKeys.pregnancyInfo(drugName),
        queryFn: () => interactionApi.getPregnancyInfo(drugName),
        enabled: !!drugName,
        staleTime: 24 * 60 * 60 * 1000, // 24 hours for pregnancy info
        refetchOnWindowFocus: false,
    });
};

// ===============================
// MUTATION HOOKS
// ===============================

/**
 * Hook to manually trigger interaction check
 */
export const useManualInteractionCheck = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: { medications: string[]; patientAllergies?: string[] }) =>
            interactionApi.checkInteractions(data),
        onSuccess: (response, variables) => {
            const result = response?.data;

            if (result) {
                // Update cache with the result
                queryClient.setQueryData(
                    interactionQueryKeys.check(variables.medications, variables.patientAllergies),
                    response
                );

                // Show notification based on findings
                const totalIssues =
                    result.interactions.length +
                    result.allergicReactions.length +
                    result.contraindications.length;

                if (totalIssues === 0) {
                    addNotification({
                        type: 'success',
                        title: 'No Interactions Found',
                        message: 'No significant drug interactions, allergies, or contraindications detected.',
                        duration: 4000,
                    });
                } else {
                    const severityLevel = result.interactions.some(i => i.severity === 'major') ||
                        result.allergicReactions.some(a => a.severity === 'severe') ? 'error' : 'warning';

                    addNotification({
                        type: severityLevel,
                        title: 'Interactions Detected',
                        message: `Found ${totalIssues} potential issue(s). Please review carefully.`,
                        duration: 6000,
                    });
                }
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Interaction Check Failed',
                message: error.message || 'Failed to check drug interactions. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to batch check multiple drug combinations
 */
export const useBatchInteractionCheck = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: async (drugCombinations: Array<{
            medications: string[];
            patientAllergies?: string[];
            label?: string;
        }>) => {
            const results = await Promise.allSettled(
                drugCombinations.map(combo =>
                    interactionApi.checkInteractions({
                        medications: combo.medications,
                        patientAllergies: combo.patientAllergies,
                    })
                )
            );

            return results.map((result, index) => ({
                ...drugCombinations[index],
                status: result.status,
                data: result.status === 'fulfilled' ? result.value.data : null,
                error: result.status === 'rejected' ? result.reason : null,
            }));
        },
        onSuccess: (results) => {
            // Cache individual results
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.data) {
                    queryClient.setQueryData(
                        interactionQueryKeys.check(result.medications, result.patientAllergies),
                        { data: result.data }
                    );
                }
            });

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const errorCount = results.filter(r => r.status === 'rejected').length;

            if (errorCount === 0) {
                addNotification({
                    type: 'success',
                    title: 'Batch Check Complete',
                    message: `Successfully checked ${successCount} drug combination(s).`,
                    duration: 4000,
                });
            } else {
                addNotification({
                    type: 'warning',
                    title: 'Batch Check Partial',
                    message: `Checked ${successCount} combination(s), ${errorCount} failed.`,
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Batch Check Failed',
                message: error.message || 'Failed to perform batch interaction check.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook to get cached interaction data
 */
export const useCachedInteractions = (medications: string[], allergies?: string[]) => {
    const queryClient = useQueryClient();

    return React.useMemo(() => {
        const cachedData = queryClient.getQueryData(
            interactionQueryKeys.check(medications, allergies)
        ) as ApiResponse<InteractionCheckResult> | undefined;

        return cachedData?.data || null;
    }, [queryClient, medications, allergies]);
};

/**
 * Hook to prefetch drug information
 */
export const usePrefetchDrugInfo = () => {
    const queryClient = useQueryClient();

    return (drugName: string) => {
        queryClient.prefetchQuery({
            queryKey: interactionQueryKeys.drugInfo(drugName),
            queryFn: () => interactionApi.getDrugInfo(drugName),
            staleTime: 30 * 60 * 1000, // 30 minutes
        });
    };
};

/**
 * Hook to get interaction severity summary
 */
export const useInteractionSeveritySummary = (medications: string[], allergies?: string[]) => {
    const { data, isLoading, error } = useCheckInteractions(medications, allergies);

    const summary = React.useMemo(() => {
        if (!data?.data) return null;

        const result = data.data;

        return {
            total: result.interactions.length + result.allergicReactions.length + result.contraindications.length,
            major: result.interactions.filter(i => i.severity === 'major').length,
            moderate: result.interactions.filter(i => i.severity === 'moderate').length,
            minor: result.interactions.filter(i => i.severity === 'minor').length,
            severeAllergies: result.allergicReactions.filter(a => a.severity === 'severe').length,
            contraindications: result.contraindications.length,
            hasHighRisk: result.interactions.some(i => i.severity === 'major') ||
                result.allergicReactions.some(a => a.severity === 'severe') ||
                result.contraindications.length > 0,
        };
    }, [data]);

    return {
        summary,
        isLoading,
        error,
        rawData: data?.data,
    };
};

/**
 * Hook to manage interaction checking with background refetching
 */
export const useInteractionMonitoring = (
    medications: string[],
    allergies?: string[],
    options?: {
        enableBackgroundRefetch?: boolean;
        refetchInterval?: number;
    }
) => {
    const { enableBackgroundRefetch = false, refetchInterval = 5 * 60 * 1000 } = options || {};

    return useQuery({
        queryKey: interactionQueryKeys.check(medications, allergies),
        queryFn: () => interactionApi.checkInteractions({
            medications,
            patientAllergies: allergies,
        }),
        enabled: medications.length >= 2,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchInterval: enableBackgroundRefetch ? refetchInterval : false,
        refetchIntervalInBackground: enableBackgroundRefetch,
        refetchOnWindowFocus: false,
    });
};

export default useCheckInteractions;