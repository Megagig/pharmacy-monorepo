import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labApi } from '../api/labApi';
import { useUIStore } from '../../../stores';
import type { ApiResponse } from '../types';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// Lab trend data type
interface LabTrendData {
    testCode: string;
    testName: string;
    unit?: string;
    referenceRange: {
        low?: number;
        high?: number;
        text?: string;
    };
    results: Array<{
        value: string;
        numericValue?: number;
        interpretation: string;
        performedAt: string;
        flags: string[];
    }>;
    trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
    summary: {
        latestValue: string;
        latestInterpretation: string;
        changeFromPrevious?: number;
        abnormalCount: number;
        totalCount: number;
    };
}

// Lab test catalog item type
interface LabTestCatalogItem {
    code: string;
    name: string;
    loincCode?: string;
    category: string;
    description?: string;
    referenceRange?: {
        low?: number;
        high?: number;
        text?: string;
        unit?: string;
    };
}

// Reference range data type
interface ReferenceRangeData {
    testCode: string;
    testName: string;
    ranges: Array<{
        ageGroup?: string;
        gender?: string;
        low?: number;
        high?: number;
        unit?: string;
        text?: string;
    }>;
}

// Query keys for lab trends and catalog
export const labTrendQueryKeys = {
    all: ['lab', 'trends'] as const,
    trends: (patientId: string, testCode: string, days?: number) =>
        ['lab', 'trends', patientId, testCode, days] as const,
    catalog: {
        all: ['lab', 'catalog'] as const,
        search: (search?: string) => ['lab', 'catalog', 'search', search] as const,
    },
    referenceRanges: (testCode: string) => ['lab', 'reference-ranges', testCode] as const,
    fhir: {
        all: ['lab', 'fhir'] as const,
        import: ['lab', 'fhir', 'import'] as const,
        export: (orderId: string) => ['lab', 'fhir', 'export', orderId] as const,
    },
};

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to fetch lab trends for a specific test and patient
 */
export const useLabTrends = (patientId: string, testCode: string, days: number = 90) => {
    return useQuery({
        queryKey: labTrendQueryKeys.trends(patientId, testCode, days),
        queryFn: () => labApi.getTrends(patientId, testCode, days),
        enabled: !!patientId && !!testCode,
        staleTime: 5 * 60 * 1000, // 5 minutes for trend data
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch lab test catalog with optional search
 */
export const useLabTestCatalog = (search?: string) => {
    return useQuery({
        queryKey: labTrendQueryKeys.catalog.search(search),
        queryFn: () => labApi.getTestCatalog(search),
        staleTime: 10 * 60 * 1000, // 10 minutes for catalog data
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch reference ranges for a specific test
 */
export const useReferenceRanges = (testCode: string) => {
    return useQuery({
        queryKey: labTrendQueryKeys.referenceRanges(testCode),
        queryFn: () => labApi.getReferenceRanges(testCode),
        enabled: !!testCode,
        staleTime: 30 * 60 * 1000, // 30 minutes for reference ranges
        refetchOnWindowFocus: false,
    });
};

// ===============================
// FHIR INTEGRATION HOOKS
// ===============================

/**
 * Hook to import FHIR lab data
 */
export const useFHIRImport = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: {
            fhirBundle: any;
            patientMapping: {
                fhirPatientId: string;
                internalPatientId: string;
            };
        }) => labApi.importFHIR(data),
        onSuccess: (response, variables) => {
            const results = response?.data;

            if (results && Array.isArray(results)) {
                // Invalidate related queries for the patient
                queryClient.invalidateQueries({
                    queryKey: ['lab', 'results', 'patient', variables.patientMapping.internalPatientId]
                });
                queryClient.invalidateQueries({
                    queryKey: ['lab', 'results', 'list']
                });

                // Invalidate trends for imported tests
                const uniqueTestCodes = [...new Set(results.map(result => result.testCode))];
                uniqueTestCodes.forEach(testCode => {
                    queryClient.invalidateQueries({
                        queryKey: labTrendQueryKeys.trends(
                            variables.patientMapping.internalPatientId,
                            testCode
                        )
                    });
                });

                // Invalidate critical and abnormal results
                queryClient.invalidateQueries({ queryKey: ['lab', 'results', 'critical'] });
                queryClient.invalidateQueries({
                    queryKey: ['lab', 'results', 'abnormal', variables.patientMapping.internalPatientId]
                });

                addNotification({
                    type: 'success',
                    title: 'FHIR Import Successful',
                    message: `Successfully imported ${results.length} lab result(s) from FHIR bundle.`,
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'FHIR Import Failed',
                message: error.message || 'Failed to import FHIR lab data. Please check the bundle format and try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to export lab order to FHIR format
 */
export const useFHIRExport = () => {
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (orderId: string) => labApi.exportOrder(orderId),
        onSuccess: (response, orderId) => {
            const exportData = response?.data;

            if (exportData) {
                addNotification({
                    type: 'success',
                    title: 'FHIR Export Successful',
                    message: `Lab order has been successfully exported to FHIR format.`,
                    duration: 4000,
                });

                // Optionally download the FHIR resource
                const blob = new Blob([JSON.stringify(exportData.fhirResource, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `lab-order-${orderId}-fhir.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'FHIR Export Failed',
                message: error.message || 'Failed to export lab order to FHIR format. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook to get multiple lab trends for a patient
 */
export const useMultipleLabTrends = (
    patientId: string,
    testCodes: string[],
    days: number = 90
) => {
    const queries = testCodes.map(testCode => ({
        queryKey: labTrendQueryKeys.trends(patientId, testCode, days),
        queryFn: () => labApi.getTrends(patientId, testCode, days),
        enabled: !!patientId && !!testCode,
        staleTime: 5 * 60 * 1000,
    }));

    return useQuery({
        queryKey: ['lab', 'trends', 'multiple', patientId, testCodes, days],
        queryFn: async () => {
            const results = await Promise.allSettled(
                testCodes.map(testCode => labApi.getTrends(patientId, testCode, days))
            );

            return results.map((result, index) => ({
                testCode: testCodes[index],
                status: result.status,
                data: result.status === 'fulfilled' ? result.value.data : null,
                error: result.status === 'rejected' ? result.reason : null,
            }));
        },
        enabled: !!patientId && testCodes.length > 0,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to search lab test catalog with debouncing
 */
export const useSearchLabTestCatalog = (searchTerm: string, debounceMs: number = 300) => {
    const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(searchTerm);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchTerm, debounceMs]);

    return useQuery({
        queryKey: labTrendQueryKeys.catalog.search(debouncedSearchTerm),
        queryFn: () => labApi.getTestCatalog(debouncedSearchTerm),
        enabled: debouncedSearchTerm.length >= 2, // Only search with 2+ characters
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to prefetch lab trends
 */
export const usePrefetchLabTrends = () => {
    const queryClient = useQueryClient();

    return (patientId: string, testCode: string, days: number = 90) => {
        queryClient.prefetchQuery({
            queryKey: labTrendQueryKeys.trends(patientId, testCode, days),
            queryFn: () => labApi.getTrends(patientId, testCode, days),
            staleTime: 5 * 60 * 1000,
        });
    };
};

/**
 * Hook to get trend summary for multiple tests
 */
export const useLabTrendSummary = (patientId: string, testCodes: string[], days: number = 90) => {
    const trendsQuery = useMultipleLabTrends(patientId, testCodes, days);

    const summary = React.useMemo(() => {
        if (!trendsQuery.data) return null;

        const trends = trendsQuery.data.filter(item => item.status === 'fulfilled' && item.data);

        return {
            totalTests: trends.length,
            improving: trends.filter(item => item.data?.trend === 'improving').length,
            stable: trends.filter(item => item.data?.trend === 'stable').length,
            worsening: trends.filter(item => item.data?.trend === 'worsening').length,
            insufficientData: trends.filter(item => item.data?.trend === 'insufficient_data').length,
            abnormalResults: trends.reduce((sum, item) =>
                sum + (item.data?.summary?.abnormalCount || 0), 0
            ),
            totalResults: trends.reduce((sum, item) =>
                sum + (item.data?.summary?.totalCount || 0), 0
            ),
        };
    }, [trendsQuery.data]);

    return {
        ...trendsQuery,
        summary,
    };
};

// Add React import for hooks that use React.useState and React.useEffect
import React from 'react';

export default useLabTrends;