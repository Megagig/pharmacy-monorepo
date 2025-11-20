import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientMTRIntegrationService } from '../services/patientMTRIntegrationService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';
import type {
    MTRMedicationEntry,
} from '../types/patientManagement';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// ===============================
// PATIENT MTR SUMMARY HOOKS
// ===============================

/**
 * Hook to fetch MTR summary for a patient
 */
export const usePatientMTRSummary = (patientId: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['patients', patientId, 'mtr', 'summary'],
        queryFn: () => patientMTRIntegrationService.getPatientMTRSummary(patientId),
        enabled: !!patientId && enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: ApiError) => {
            // Don't retry on 404 or 403 errors
            if (error?.response?.status === 404 || error?.response?.status === 403) {
                return false;
            }
            // Don't retry on 429 (rate limit) errors
            if (error?.response?.status === 429) {
                return false;
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
};

/**
 * Hook to fetch comprehensive patient data for MTR
 */
export const usePatientDataForMTR = (patientId: string) => {
    return useQuery({
        queryKey: ['patients', patientId, 'mtr', 'data'],
        queryFn: () => patientMTRIntegrationService.getPatientDataForMTR(patientId),
        enabled: !!patientId,
        staleTime: 1 * 60 * 1000, // 1 minute
    });
};

/**
 * Hook to fetch MTR dashboard data for patient
 */
export const usePatientDashboardMTRData = (patientId: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['patients', patientId, 'dashboard', 'mtr'],
        queryFn: () => patientMTRIntegrationService.getPatientDashboardMTRData(patientId),
        enabled: !!patientId && enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: ApiError) => {
            // Don't retry on 404 or 403 errors
            if (error?.response?.status === 404 || error?.response?.status === 403) {
                return false;
            }
            // Don't retry on 429 (rate limit) errors
            if (error?.response?.status === 429) {
                return false;
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
};

/**
 * Hook to fetch MTR status for multiple patients
 */
export const useBulkPatientMTRStatus = (patientIds: string[]) => {
    return useQuery({
        queryKey: ['patients', 'bulk', 'mtr-status', patientIds.sort().join(',')],
        queryFn: () => patientMTRIntegrationService.getBulkPatientMTRStatus(patientIds),
        enabled: patientIds.length > 0,
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to search patients with MTR filters
 */
export const useSearchPatientsWithMTR = (params: {
    hasActiveMTR?: boolean;
    mtrStatus?: 'none' | 'active' | 'overdue' | 'scheduled';
    lastMTRBefore?: string;
    lastMTRAfter?: string;
    needsReview?: boolean;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: ['patients', 'search', 'with-mtr', params],
        queryFn: () => patientMTRIntegrationService.searchPatientsWithMTR(params),
        staleTime: 2 * 60 * 1000,
    });
};

// ===============================
// MEDICATION SYNCHRONIZATION HOOKS
// ===============================

/**
 * Hook to sync medications between patient records and MTR
 */
export const useSyncMedicationsWithMTR = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ patientId, mtrId }: { patientId: string; mtrId: string }) =>
            patientMTRIntegrationService.syncMedicationsWithMTR(patientId, mtrId),
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'medications']
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.mtr.detail(variables.mtrId)
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });

            const { syncStatus, conflicts } = data;

            if (syncStatus === 'synced') {
                addNotification({
                    type: 'success',
                    title: 'Medications Synchronized',
                    message: 'Patient medications have been successfully synchronized with MTR.',
                    duration: 4000,
                });
            } else if (syncStatus === 'conflicts' && conflicts) {
                addNotification({
                    type: 'warning',
                    title: 'Synchronization Conflicts',
                    message: `Found ${conflicts.length} conflicts that need manual resolution.`,
                    duration: 6000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Synchronization Failed',
                message: error.message || 'Failed to synchronize medications. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to import patient medications into MTR
 */
export const useImportPatientMedicationsToMTR = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            patientId,
            mtrId,
            medicationIds
        }: {
            patientId: string;
            mtrId: string;
            medicationIds?: string[]
        }) =>
            patientMTRIntegrationService.importPatientMedicationsToMTR(
                patientId,
                mtrId,
                medicationIds
            ),
        onSuccess: (data, variables) => {
            // Invalidate MTR session to refresh medications
            queryClient.invalidateQueries({
                queryKey: queryKeys.mtr.detail(variables.mtrId)
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });

            addNotification({
                type: 'success',
                title: 'Medications Imported',
                message: `Successfully imported ${data.length} medications into MTR session.`,
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Import Failed',
                message: error.message || 'Failed to import medications. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to export MTR medications to patient records
 */
export const useExportMTRMedicationsToPatient = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            patientId,
            mtrId,
            medications
        }: {
            patientId: string;
            mtrId: string;
            medications: MTRMedicationEntry[]
        }) =>
            patientMTRIntegrationService.exportMTRMedicationsToPatient(
                patientId,
                mtrId,
                medications
            ),
        onSuccess: (data, variables) => {
            // Invalidate patient medications to refresh
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'medications']
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });

            addNotification({
                type: 'success',
                title: 'Medications Exported',
                message: `Successfully exported ${data.length} medications to patient records.`,
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Export Failed',
                message: error.message || 'Failed to export medications. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// DTP SYNCHRONIZATION HOOKS
// ===============================

/**
 * Hook to sync DTPs between patient records and MTR
 */
export const useSyncDTPsWithMTR = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ patientId, mtrId }: { patientId: string; mtrId: string }) =>
            patientMTRIntegrationService.syncDTPsWithMTR(patientId, mtrId),
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'dtps']
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.drugTherapyProblems.byReview(variables.mtrId)
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });

            const { syncStatus } = data;

            if (syncStatus === 'synced') {
                addNotification({
                    type: 'success',
                    title: 'DTPs Synchronized',
                    message: 'Drug therapy problems have been successfully synchronized.',
                    duration: 4000,
                });
            } else {
                addNotification({
                    type: 'info',
                    title: 'DTPs Need Update',
                    message: 'Some drug therapy problems need manual review and update.',
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'DTP Sync Failed',
                message: error.message || 'Failed to synchronize DTPs. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to create patient DTP from MTR DTP
 */
export const useCreatePatientDTPFromMTR = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ patientId, mtrDTPId }: { patientId: string; mtrDTPId: string }) =>
            patientMTRIntegrationService.createPatientDTPFromMTR(patientId, mtrDTPId),
        onSuccess: (data, variables) => {
            // Invalidate patient DTPs
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'dtps']
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });

            addNotification({
                type: 'success',
                title: 'DTP Created',
                message: 'Drug therapy problem has been added to patient records.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'DTP Creation Failed',
                message: error.message || 'Failed to create patient DTP. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// MTR STATUS UPDATE HOOKS
// ===============================

/**
 * Hook to update patient MTR status
 */
export const useUpdatePatientMTRStatus = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            patientId,
            status
        }: {
            patientId: string;
            status: {
                hasActiveMTR: boolean;
                lastMTRDate?: string;
                nextScheduledMTR?: string;
                mtrStatus: 'none' | 'active' | 'overdue' | 'scheduled';
            }
        }) =>
            patientMTRIntegrationService.updatePatientMTRStatus(patientId, status),
        onSuccess: (data, variables) => {
            // Update patient in cache
            queryClient.setQueryData(['patients', variables.patientId], (old: Record<string, unknown>) => ({
                ...old,
                data: {
                    ...old?.data,
                    patient: data,
                },
            }));

            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'mtr']
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', 'list']
            });

            addNotification({
                type: 'success',
                title: 'MTR Status Updated',
                message: 'Patient MTR status has been successfully updated.',
                duration: 3000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Status Update Failed',
                message: error.message || 'Failed to update MTR status. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update MTR status for multiple patients
 */
export const useUpdateBulkPatientMTRStatus = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (updates: Array<{
            patientId: string;
            hasActiveMTR: boolean;
            mtrStatus: 'none' | 'active' | 'overdue' | 'scheduled';
            lastMTRDate?: string;
        }>) =>
            patientMTRIntegrationService.updateBulkPatientMTRStatus(updates),
        onSuccess: (_, variables) => {
            // Invalidate patient lists and individual patient queries
            queryClient.invalidateQueries({ queryKey: ['patients', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['patients', 'search'] });

            variables.forEach(update => {
                queryClient.invalidateQueries({
                    queryKey: ['patients', update.patientId, 'mtr']
                });
            });

            addNotification({
                type: 'success',
                title: 'Bulk Update Complete',
                message: `Successfully updated MTR status for ${variables.length} patients.`,
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Bulk Update Failed',
                message: error.message || 'Failed to update patient MTR statuses. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// CLINICAL NOTES INTEGRATION HOOKS
// ===============================

/**
 * Hook to add MTR summary to patient clinical notes
 */
export const useAddMTRSummaryToNotes = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            patientId,
            mtrId,
            summary
        }: {
            patientId: string;
            mtrId: string;
            summary: {
                problemsIdentified: number;
                interventionsMade: number;
                medicationsOptimized: number;
                followUpRequired: boolean;
                nextReviewDate?: string;
                pharmacistNotes?: string;
            }
        }) =>
            patientMTRIntegrationService.addMTRSummaryToNotes(patientId, mtrId, summary),
        onSuccess: (_, variables) => {
            // Invalidate clinical notes
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'clinical-notes']
            });
            queryClient.invalidateQueries({
                queryKey: ['patients', variables.patientId, 'visits']
            });

            addNotification({
                type: 'success',
                title: 'MTR Summary Added',
                message: 'MTR summary has been added to patient clinical notes.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Failed to Add Summary',
                message: error.message || 'Failed to add MTR summary to notes. Please try again.',
                duration: 5000,
            });
        },
    });
};