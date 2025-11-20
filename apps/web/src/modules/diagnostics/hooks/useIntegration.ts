import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diagnosticIntegrationApi } from '../api/integrationApi';
import { toast } from 'react-hot-toast';

export interface CreateClinicalNoteFromDiagnosticData {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
    noteData?: {
        title?: string;
        content?: {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
        };
        type?: 'consultation' | 'medication_review' | 'follow_up' | 'adverse_event' | 'other';
        priority?: 'low' | 'medium' | 'high';
        followUpRequired?: boolean;
        followUpDate?: Date;
        tags?: string[];
        recommendations?: string[];
    };
}

export interface AddDiagnosticDataToMTRData {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
}

export interface CreateMTRFromDiagnosticData {
    diagnosticRequestId: string;
    diagnosticResultId?: string;
    patientId: string;
    mtrData?: {
        priority?: 'routine' | 'urgent' | 'high_risk';
        reviewReason?: string;
    };
}

/**
 * Hook to create clinical note from diagnostic results
 */
export const useCreateClinicalNoteFromDiagnostic = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateClinicalNoteFromDiagnosticData) =>
            diagnosticIntegrationApi.createClinicalNoteFromDiagnostic(data),
        onSuccess: (response, variables) => {
            toast.success('Clinical note created successfully from diagnostic results');

            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['clinicalNotes', variables.patientId],
            });
            queryClient.invalidateQueries({
                queryKey: ['patientTimeline', variables.patientId],
            });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.error?.message || 'Failed to create clinical note';
            toast.error(message);
        },
    });
};

/**
 * Hook to add diagnostic data to existing MTR
 */
export const useAddDiagnosticDataToMTR = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ mtrId, data }: { mtrId: string; data: AddDiagnosticDataToMTRData }) =>
            diagnosticIntegrationApi.addDiagnosticDataToMTR(mtrId, data),
        onSuccess: (response, variables) => {
            toast.success('MTR enriched successfully with diagnostic data');

            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['mtr', variables.mtrId],
            });
            queryClient.invalidateQueries({
                queryKey: ['mtrs', variables.data.patientId],
            });
            queryClient.invalidateQueries({
                queryKey: ['patientTimeline', variables.data.patientId],
            });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.error?.message || 'Failed to enrich MTR with diagnostic data';
            toast.error(message);
        },
    });
};

/**
 * Hook to create new MTR from diagnostic results
 */
export const useCreateMTRFromDiagnostic = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateMTRFromDiagnosticData) =>
            diagnosticIntegrationApi.createMTRFromDiagnostic(data),
        onSuccess: (response, variables) => {
            toast.success('MTR created successfully from diagnostic results');

            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['mtrs', variables.patientId],
            });
            queryClient.invalidateQueries({
                queryKey: ['patientTimeline', variables.patientId],
            });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.error?.message || 'Failed to create MTR from diagnostic';
            toast.error(message);
        },
    });
};

/**
 * Hook to get unified patient timeline
 */
export const useUnifiedPatientTimeline = (
    patientId: string,
    options: {
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        enabled?: boolean;
    } = {}
) => {
    const { startDate, endDate, limit, enabled = true } = options;

    return useQuery({
        queryKey: ['patientTimeline', patientId, { startDate, endDate, limit }],
        queryFn: () => diagnosticIntegrationApi.getUnifiedPatientTimeline(patientId, {
            startDate,
            endDate,
            limit,
        }),
        enabled: enabled && !!patientId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to cross-reference diagnostic data with existing records
 */
export const useCrossReferenceWithExistingRecords = (
    diagnosticRequestId: string,
    options: {
        enabled?: boolean;
    } = {}
) => {
    const { enabled = true } = options;

    return useQuery({
        queryKey: ['crossReference', diagnosticRequestId],
        queryFn: () => diagnosticIntegrationApi.crossReferenceWithExistingRecords(diagnosticRequestId),
        enabled: enabled && !!diagnosticRequestId,
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to get integration options for a diagnostic result
 */
export const useIntegrationOptions = (
    diagnosticRequestId: string,
    options: {
        enabled?: boolean;
    } = {}
) => {
    const { enabled = true } = options;

    return useQuery({
        queryKey: ['integrationOptions', diagnosticRequestId],
        queryFn: () => diagnosticIntegrationApi.getIntegrationOptions(diagnosticRequestId),
        enabled: enabled && !!diagnosticRequestId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to get integration status and recommendations
 */
export const useIntegrationRecommendations = (
    diagnosticRequestId: string,
    patientId: string
) => {
    const { data: crossReference, isLoading: crossRefLoading } = useCrossReferenceWithExistingRecords(
        diagnosticRequestId,
        { enabled: !!diagnosticRequestId }
    );

    const { data: integrationOptions, isLoading: optionsLoading } = useIntegrationOptions(
        diagnosticRequestId,
        { enabled: !!diagnosticRequestId }
    );

    const isLoading = crossRefLoading || optionsLoading;

    const recommendations = {
        shouldCreateClinicalNote: true,
        shouldCreateMTR: !crossReference?.relatedMTRs?.length,
        shouldEnrichExistingMTR: crossReference?.relatedMTRs?.some(mtr => mtr.status === 'in_progress'),
        existingMTRs: crossReference?.relatedMTRs || [],
        correlations: crossReference?.correlations || [],
        integrationOptions: integrationOptions || null,
    };

    return {
        recommendations,
        isLoading,
        crossReference,
        integrationOptions,
    };
};

/**
 * Hook for batch integration operations
 */
export const useBatchIntegration = () => {
    const createClinicalNote = useCreateClinicalNoteFromDiagnostic();
    const createMTR = useCreateMTRFromDiagnostic();
    const enrichMTR = useAddDiagnosticDataToMTR();

    const executeBatchIntegration = async (
        diagnosticRequestId: string,
        diagnosticResultId: string | undefined,
        patientId: string,
        operations: {
            createClinicalNote?: boolean;
            createMTR?: boolean;
            enrichMTRId?: string;
            noteData?: CreateClinicalNoteFromDiagnosticData['noteData'];
            mtrData?: CreateMTRFromDiagnosticData['mtrData'];
        }
    ) => {
        const results: {
            clinicalNote?: any;
            mtr?: any;
            enrichedMTR?: any;
            errors: string[];
        } = {
            errors: [],
        };

        try {
            // Create clinical note if requested
            if (operations.createClinicalNote) {
                try {
                    const clinicalNoteResult = await createClinicalNote.mutateAsync({
                        diagnosticRequestId,
                        diagnosticResultId,
                        patientId,
                        noteData: operations.noteData,
                    });
                    results.clinicalNote = clinicalNoteResult.data.clinicalNote;
                } catch (error: any) {
                    results.errors.push(`Clinical note creation failed: ${error.message}`);
                }
            }

            // Create new MTR if requested
            if (operations.createMTR) {
                try {
                    const mtrResult = await createMTR.mutateAsync({
                        diagnosticRequestId,
                        diagnosticResultId,
                        patientId,
                        mtrData: operations.mtrData,
                    });
                    results.mtr = mtrResult.data.mtr;
                } catch (error: any) {
                    results.errors.push(`MTR creation failed: ${error.message}`);
                }
            }

            // Enrich existing MTR if requested
            if (operations.enrichMTRId) {
                try {
                    const enrichResult = await enrichMTR.mutateAsync({
                        mtrId: operations.enrichMTRId,
                        data: {
                            diagnosticRequestId,
                            diagnosticResultId,
                            patientId,
                        },
                    });
                    results.enrichedMTR = enrichResult.data.mtr;
                } catch (error: any) {
                    results.errors.push(`MTR enrichment failed: ${error.message}`);
                }
            }

            if (results.errors.length === 0) {
                toast.success('Integration completed successfully');
            } else if (results.errors.length < Object.keys(operations).length) {
                toast.success('Integration partially completed with some errors');
            }

            return results;

        } catch (error: any) {
            toast.error('Integration failed');
            throw error;
        }
    };

    return {
        executeBatchIntegration,
        isLoading: createClinicalNote.isPending || createMTR.isPending || enrichMTR.isPending,
    };
};