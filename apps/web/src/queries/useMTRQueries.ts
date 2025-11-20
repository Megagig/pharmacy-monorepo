import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mtrService } from '../services/mtrService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';
import type {
    // MedicationTherapyReview,
    // DrugTherapyProblem,
    // MTRIntervention,
    // MTRFollowUp,
    CreateMTRData,
    UpdateMTRData,
    CreateDTPData,
    UpdateDTPData,
    CreateInterventionData,
    // UpdateInterventionData,
    // CreateFollowUpData,
    // UpdateFollowUpData,
    MTRSearchParams,
    DTPSearchParams,
    InterventionSearchParams,
    FollowUpSearchParams,
} from '../types/mtr';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// ===============================
// MTR SESSION HOOKS
// ===============================

/**
 * Hook to fetch MTR sessions with optional filters
 */
export const useMTRSessions = (params: MTRSearchParams = {}) => {
    return useQuery({
        queryKey: queryKeys.mtr.list(params),
        queryFn: () => mtrService.getMTRSessions(params),
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};

/**
 * Hook to fetch a single MTR session by ID
 */
export const useMTRSession = (sessionId: string) => {
    return useQuery({
        queryKey: queryKeys.mtr.detail(sessionId),
        queryFn: () => mtrService.getMTRSession(sessionId),
        enabled: !!sessionId,
        staleTime: 1 * 60 * 1000, // 1 minute
    });
};

/**
 * Hook to fetch MTR sessions by patient
 */
export const useMTRSessionsByPatient = (patientId: string, params: Omit<MTRSearchParams, 'patientId'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtr.byPatient(patientId),
        queryFn: () => mtrService.getMTRSessionsByPatient(patientId, params),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch active MTR sessions
 */
export const useActiveMTRSessions = (params: Omit<MTRSearchParams, 'status'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtr.active(),
        queryFn: () => mtrService.getActiveMTRSessions(params),
        staleTime: 1 * 60 * 1000,
    });
};

/**
 * Hook to fetch overdue MTR sessions
 */
export const useOverdueMTRSessions = () => {
    return useQuery({
        queryKey: queryKeys.mtr.overdue(),
        queryFn: () => mtrService.getOverdueMTRSessions(),
        staleTime: 30 * 1000, // 30 seconds - overdue data should be fresh
    });
};

/**
 * Hook to fetch MTR workflow steps
 */
export const useMTRWorkflowSteps = () => {
    return useQuery({
        queryKey: queryKeys.mtr.workflowSteps(),
        queryFn: () => mtrService.getWorkflowSteps(),
        staleTime: 10 * 60 * 1000, // 10 minutes - workflow steps rarely change
    });
};

/**
 * Hook to create a new MTR session
 */
export const useCreateMTRSession = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (sessionData: CreateMTRData) => mtrService.createMTRSession(sessionData),
        onSuccess: (data, variables) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.byPatient(variables.patientId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.active() });

            // Add optimistic update for the new session
            const newSession = data?.review || data?.data?.review;
            if (newSession) {
                queryClient.setQueryData(queryKeys.mtr.detail(newSession._id), data);
            }

            addNotification({
                type: 'success',
                title: 'MTR Session Created',
                message: `MTR session ${newSession?.reviewNumber || ''} has been successfully created.`,
                duration: 5000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Creation Failed',
                message: error.message || 'Failed to create MTR session. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update an MTR session
 */
export const useUpdateMTRSession = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ sessionId, sessionData }: { sessionId: string; sessionData: UpdateMTRData }) =>
            mtrService.updateMTRSession(sessionId, sessionData),
        onMutate: async ({ sessionId, sessionData }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.mtr.detail(sessionId) });

            // Snapshot previous value
            const previousSession = queryClient.getQueryData(queryKeys.mtr.detail(sessionId));

            // Optimistically update
            if (previousSession) {
                queryClient.setQueryData(queryKeys.mtr.detail(sessionId), (old: unknown) => ({
                    ...old,
                    data: {
                        ...old.data,
                        review: {
                            ...old.data.review,
                            ...sessionData,
                            updatedAt: new Date().toISOString(),
                        },
                    },
                }));
            }

            return { previousSession };
        },
        onSuccess: (data, variables) => {
            // Update the specific session in cache
            queryClient.setQueryData(queryKeys.mtr.detail(variables.sessionId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.lists() });

            const session = data?.data?.review;
            if (session?.patientId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.mtr.byPatient(session.patientId) });
            }

            addNotification({
                type: 'success',
                title: 'MTR Session Updated',
                message: 'MTR session has been successfully updated.',
                duration: 4000,
            });
        },
        onError: (error: ApiError, variables, context) => {
            // Rollback optimistic update
            if (context?.previousSession) {
                queryClient.setQueryData(queryKeys.mtr.detail(variables.sessionId), context.previousSession);
            }

            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update MTR session. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to delete an MTR session
 */
export const useDeleteMTRSession = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (sessionId: string) => mtrService.deleteMTRSession(sessionId),
        onSuccess: (_, sessionId) => {
            // Remove session from cache
            queryClient.removeQueries({ queryKey: queryKeys.mtr.detail(sessionId) });

            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.active() });

            addNotification({
                type: 'success',
                title: 'MTR Session Deleted',
                message: 'MTR session has been successfully deleted.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Deletion Failed',
                message: error.message || 'Failed to delete MTR session. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to complete a workflow step
 */
export const useCompleteWorkflowStep = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ sessionId, stepName, stepData }: { sessionId: string; stepName: string; stepData?: unknown }) =>
            mtrService.completeWorkflowStep(sessionId, stepName, stepData),
        onSuccess: (data, variables) => {
            // Update the session in cache
            queryClient.setQueryData(queryKeys.mtr.detail(variables.sessionId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.lists() });

            addNotification({
                type: 'success',
                title: 'Step Completed',
                message: `Workflow step "${variables.stepName}" has been completed.`,
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Step Completion Failed',
                message: error.message || 'Failed to complete workflow step. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to check drug interactions
 */
export const useCheckDrugInteractions = () => {
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (sessionId: string) => mtrService.checkDrugInteractions(sessionId),
        onSuccess: (data) => {
            const interactions = data?.data;
            if (interactions?.hasInteractions) {
                addNotification({
                    type: 'warning',
                    title: 'Drug Interactions Found',
                    message: `Found ${interactions.interactions?.length || 0} potential drug interactions.`,
                    duration: 6000,
                });
            } else {
                addNotification({
                    type: 'success',
                    title: 'No Interactions Found',
                    message: 'No significant drug interactions detected.',
                    duration: 4000,
                });
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

// ===============================
// DRUG THERAPY PROBLEM HOOKS
// ===============================

/**
 * Hook to fetch drug therapy problems with optional filters
 */
export const useDrugTherapyProblems = (params: DTPSearchParams = {}) => {
    return useQuery({
        queryKey: queryKeys.drugTherapyProblems.list(params),
        queryFn: () => mtrService.getDrugTherapyProblems(params),
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch a single drug therapy problem by ID
 */
export const useDrugTherapyProblem = (problemId: string) => {
    return useQuery({
        queryKey: queryKeys.drugTherapyProblems.detail(problemId),
        queryFn: () => mtrService.getDrugTherapyProblem(problemId),
        enabled: !!problemId,
        staleTime: 1 * 60 * 1000,
    });
};

/**
 * Hook to fetch drug therapy problems by patient
 */
export const useDrugTherapyProblemsByPatient = (patientId: string, params: Omit<DTPSearchParams, 'patientId'> = {}) => {
    return useQuery({
        queryKey: queryKeys.drugTherapyProblems.byPatient(patientId),
        queryFn: () => mtrService.getDrugTherapyProblemsByPatient(patientId, params),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch active drug therapy problems
 */
export const useActiveDrugTherapyProblems = (params: Omit<DTPSearchParams, 'status'> = {}) => {
    return useQuery({
        queryKey: queryKeys.drugTherapyProblems.active(),
        queryFn: () => mtrService.getActiveDrugTherapyProblems(params),
        staleTime: 1 * 60 * 1000,
    });
};

/**
 * Hook to create a new drug therapy problem
 */
export const useCreateDrugTherapyProblem = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (problemData: CreateDTPData) => mtrService.createDrugTherapyProblem(problemData),
        onSuccess: (data, variables) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.byPatient(variables.patientId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.active() });

            if (variables.reviewId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.byReview(variables.reviewId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.mtr.detail(variables.reviewId) });
            }

            addNotification({
                type: 'success',
                title: 'Drug Therapy Problem Created',
                message: 'Drug therapy problem has been successfully identified and recorded.',
                duration: 5000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Creation Failed',
                message: error.message || 'Failed to create drug therapy problem. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update a drug therapy problem
 */
export const useUpdateDrugTherapyProblem = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ problemId, problemData }: { problemId: string; problemData: UpdateDTPData }) =>
            mtrService.updateDrugTherapyProblem(problemId, problemData),
        onSuccess: (data, variables) => {
            // Update the specific problem in cache
            queryClient.setQueryData(queryKeys.drugTherapyProblems.detail(variables.problemId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.lists() });

            addNotification({
                type: 'success',
                title: 'Drug Therapy Problem Updated',
                message: 'Drug therapy problem has been successfully updated.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update drug therapy problem. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to resolve a drug therapy problem
 */
export const useResolveDrugTherapyProblem = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ problemId, resolution }: { problemId: string; resolution: { action: string; outcome: string } }) =>
            mtrService.resolveDrugTherapyProblem(problemId, resolution),
        onSuccess: (data, variables) => {
            // Update the specific problem in cache
            queryClient.setQueryData(queryKeys.drugTherapyProblems.detail(variables.problemId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.drugTherapyProblems.active() });

            addNotification({
                type: 'success',
                title: 'Problem Resolved',
                message: 'Drug therapy problem has been successfully resolved.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Resolution Failed',
                message: error.message || 'Failed to resolve drug therapy problem. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// MTR INTERVENTION HOOKS
// ===============================

/**
 * Hook to fetch MTR interventions with optional filters
 */
export const useMTRInterventions = (params: InterventionSearchParams = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrInterventions.list(params),
        queryFn: () => mtrService.getInterventions(params),
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch interventions by review
 */
export const useMTRInterventionsByReview = (reviewId: string, params: Omit<InterventionSearchParams, 'reviewId'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrInterventions.byReview(reviewId),
        queryFn: () => mtrService.getInterventionsByReview(reviewId, params),
        enabled: !!reviewId,
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch pending interventions
 */
export const usePendingMTRInterventions = (params: Omit<InterventionSearchParams, 'outcome'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrInterventions.pending(),
        queryFn: () => mtrService.getPendingInterventions(params),
        staleTime: 1 * 60 * 1000,
    });
};

/**
 * Hook to create a new MTR intervention
 */
export const useCreateMTRIntervention = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (interventionData: CreateInterventionData) => mtrService.createIntervention(interventionData),
        onSuccess: (data, variables) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.byReview(variables.reviewId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.byPatient(variables.patientId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.pending() });

            // Update MTR session
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.detail(variables.reviewId) });

            addNotification({
                type: 'success',
                title: 'Intervention Created',
                message: 'MTR intervention has been successfully created.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Creation Failed',
                message: error.message || 'Failed to create intervention. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to complete an MTR intervention
 */
export const useCompleteMTRIntervention = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ interventionId, outcome, details }: { interventionId: string; outcome: string; details?: string }) =>
            mtrService.completeIntervention(interventionId, outcome, details),
        onSuccess: (data, variables) => {
            // Update the specific intervention in cache
            queryClient.setQueryData(queryKeys.mtrInterventions.detail(variables.interventionId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrInterventions.pending() });

            addNotification({
                type: 'success',
                title: 'Intervention Completed',
                message: 'MTR intervention has been marked as completed.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Completion Failed',
                message: error.message || 'Failed to complete intervention. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// MTR FOLLOW-UP HOOKS
// ===============================

/**
 * Hook to fetch MTR follow-ups with optional filters
 */
export const useMTRFollowUps = (params: FollowUpSearchParams = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrFollowUps.list(params),
        queryFn: () => mtrService.getFollowUps(params),
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch follow-ups by review
 */
export const useMTRFollowUpsByReview = (reviewId: string, params: Omit<FollowUpSearchParams, 'reviewId'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrFollowUps.byReview(reviewId),
        queryFn: () => mtrService.getFollowUpsByReview(reviewId, params),
        enabled: !!reviewId,
        staleTime: 2 * 60 * 1000,
    });
};

/**
 * Hook to fetch scheduled follow-ups
 */
export const useScheduledMTRFollowUps = (params: Omit<FollowUpSearchParams, 'status'> = {}) => {
    return useQuery({
        queryKey: queryKeys.mtrFollowUps.scheduled(),
        queryFn: () => mtrService.getScheduledFollowUps(params),
        staleTime: 1 * 60 * 1000,
    });
};

/**
 * Hook to fetch overdue follow-ups
 */
export const useOverdueMTRFollowUps = () => {
    return useQuery({
        queryKey: queryKeys.mtrFollowUps.overdue(),
        queryFn: () => mtrService.getOverdueFollowUps(),
        staleTime: 30 * 1000, // 30 seconds - overdue data should be fresh
    });
};

/**
 * Hook to create a new MTR follow-up
 */
export const useCreateMTRFollowUp = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (followUpData: CreateFollowUpData) => mtrService.createFollowUp(followUpData),
        onSuccess: (data, variables) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.byReview(variables.reviewId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.byPatient(variables.patientId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.scheduled() });

            // Update MTR session
            queryClient.invalidateQueries({ queryKey: queryKeys.mtr.detail(variables.reviewId) });

            addNotification({
                type: 'success',
                title: 'Follow-up Scheduled',
                message: 'MTR follow-up has been successfully scheduled.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Scheduling Failed',
                message: error.message || 'Failed to schedule follow-up. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to complete an MTR follow-up
 */
export const useCompleteMTRFollowUp = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ followUpId, outcome }: {
            followUpId: string;
            outcome: {
                status: 'successful' | 'partially_successful' | 'unsuccessful';
                notes: string;
                nextActions: string[];
                nextFollowUpDate?: string;
                adherenceImproved?: boolean;
                problemsResolved?: string[];
                newProblemsIdentified?: string[];
            }
        }) => mtrService.completeFollowUp(followUpId, outcome),
        onSuccess: (data, variables) => {
            // Update the specific follow-up in cache
            queryClient.setQueryData(queryKeys.mtrFollowUps.detail(variables.followUpId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.scheduled() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.overdue() });

            addNotification({
                type: 'success',
                title: 'Follow-up Completed',
                message: 'MTR follow-up has been marked as completed.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Completion Failed',
                message: error.message || 'Failed to complete follow-up. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to reschedule an MTR follow-up
 */
export const useRescheduleMTRFollowUp = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ followUpId, newDate, reason }: { followUpId: string; newDate: string; reason?: string }) =>
            mtrService.rescheduleFollowUp(followUpId, newDate, reason),
        onSuccess: (data, variables) => {
            // Update the specific follow-up in cache
            queryClient.setQueryData(queryKeys.mtrFollowUps.detail(variables.followUpId), data);

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.scheduled() });
            queryClient.invalidateQueries({ queryKey: queryKeys.mtrFollowUps.overdue() });

            addNotification({
                type: 'success',
                title: 'Follow-up Rescheduled',
                message: 'MTR follow-up has been successfully rescheduled.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Rescheduling Failed',
                message: error.message || 'Failed to reschedule follow-up. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// STATISTICS HOOKS
// ===============================

/**
 * Hook to fetch MTR statistics
 */
export const useMTRStatistics = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.mtr.statistics(dateRange),
        queryFn: () => mtrService.getMTRStatistics(dateRange),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

/**
 * Hook to fetch drug therapy problem statistics
 */
export const useDTPStatistics = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.drugTherapyProblems.statistics(dateRange),
        queryFn: () => mtrService.getDTPStatistics(dateRange),
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Hook to fetch intervention statistics
 */
export const useInterventionStatistics = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.mtrInterventions.statistics(dateRange),
        queryFn: () => mtrService.getInterventionStatistics(dateRange),
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Hook to fetch follow-up statistics
 */
export const useFollowUpStatistics = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.mtrFollowUps.statistics(dateRange),
        queryFn: () => mtrService.getFollowUpStatistics(dateRange),
        staleTime: 5 * 60 * 1000,
    });
};

// ===============================
// REPORTS AND ANALYTICS HOOKS
// ===============================

/**
 * Hook to fetch MTR summary report
 */
export const useMTRSummaryReport = (filters: {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
    reviewType?: string;
    priority?: string;
} = {}) => {
    return useQuery({
        queryKey: ['mtr', 'reports', 'summary', filters],
        queryFn: () => mtrService.getMTRSummaryReport(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: true,
    });
};

/**
 * Hook to fetch intervention effectiveness report
 */
export const useInterventionEffectivenessReport = (filters: {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
    interventionType?: string;
} = {}) => {
    return useQuery({
        queryKey: ['mtr', 'reports', 'interventions', filters],
        queryFn: () => mtrService.getInterventionEffectivenessReport(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: true,
    });
};

/**
 * Hook to fetch pharmacist performance report
 */
export const usePharmacistPerformanceReport = (filters: {
    startDate?: string;
    endDate?: string;
    pharmacistId?: string;
} = {}) => {
    return useQuery({
        queryKey: ['mtr', 'reports', 'pharmacists', filters],
        queryFn: () => mtrService.getPharmacistPerformanceReport(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: true,
    });
};

/**
 * Hook to fetch quality assurance report
 */
export const useQualityAssuranceReport = (filters: {
    startDate?: string;
    endDate?: string;
} = {}) => {
    return useQuery({
        queryKey: ['mtr', 'reports', 'quality', filters],
        queryFn: () => mtrService.getQualityAssuranceReport(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: true,
    });
};

/**
 * Hook to fetch outcome metrics report
 */
export const useOutcomeMetricsReport = (filters: {
    startDate?: string;
    endDate?: string;
    reviewType?: string;
} = {}) => {
    return useQuery({
        queryKey: ['mtr', 'reports', 'outcomes', filters],
        queryFn: () => mtrService.getOutcomeMetricsReport(filters),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: true,
    });
};