import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalInterventionService } from '../services/clinicalInterventionService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';
import type {
    ClinicalIntervention,
    CreateInterventionData,
    UpdateInterventionData,
    InterventionFilters,
    InterventionStrategy,
    TeamAssignment,
    InterventionOutcome,
    StrategyRecommendation,
    DashboardMetrics,
} from '../stores/clinicalInterventionStore';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to fetch interventions with optional filters
 */
export const useClinicalInterventions = (filters: InterventionFilters = {}) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.list(filters),
        queryFn: () => clinicalInterventionService.getInterventions(filters),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch a single intervention by ID
 */
export const useClinicalIntervention = (interventionId: string) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.detail(interventionId),
        queryFn: () => clinicalInterventionService.getInterventionById(interventionId),
        enabled: !!interventionId,
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to search interventions
 */
export const useSearchClinicalInterventions = (searchQuery: string) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.search(searchQuery),
        queryFn: () => clinicalInterventionService.searchInterventions(searchQuery),
        enabled: !!searchQuery && searchQuery.length >= 2,
        staleTime: 30 * 1000, // 30 seconds for search results
    });
};

/**
 * Hook to fetch interventions for a specific patient
 */
export const usePatientInterventions = (patientId: string) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.byPatient(patientId),
        queryFn: () => clinicalInterventionService.getPatientInterventions(patientId),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};

/**
 * Hook to fetch interventions assigned to current user
 */
export const useMyAssignedInterventions = () => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.assignedToMe(),
        queryFn: () => clinicalInterventionService.getMyAssignedInterventions(),
        staleTime: 1 * 60 * 1000, // 1 minute for assigned interventions
    });
};

/**
 * Hook to fetch dashboard metrics
 */
export const useInterventionDashboard = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.analytics.dashboard(dateRange),
        queryFn: () => clinicalInterventionService.getDashboardMetrics(dateRange),
        staleTime: 5 * 60 * 1000, // 5 minutes for dashboard data
    });
};

/**
 * Hook to fetch strategy recommendations for a category
 */
export const useStrategyRecommendations = (category: string) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.recommendations(category),
        queryFn: () => clinicalInterventionService.getStrategyRecommendations(category),
        enabled: !!category,
        staleTime: 10 * 60 * 1000, // 10 minutes for recommendations (relatively static)
    });
};

/**
 * Hook to check for duplicate interventions
 */
export const useDuplicateInterventions = (patientId: string, category: string) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.duplicates(patientId, category),
        queryFn: () => clinicalInterventionService.checkDuplicates(patientId, category),
        enabled: !!patientId && !!category,
        staleTime: 1 * 60 * 1000, // 1 minute for duplicate checks
    });
};

/**
 * Hook to fetch category counts
 */
export const useCategoryCounts = () => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.analytics.categories(),
        queryFn: () => clinicalInterventionService.getCategoryCounts(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

/**
 * Hook to fetch priority distribution
 */
export const usePriorityDistribution = () => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.analytics.priorities(),
        queryFn: () => clinicalInterventionService.getPriorityDistribution(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

/**
 * Hook to fetch outcome trends
 */
export const useOutcomeTrends = (dateRange?: { start: string; end: string }) => {
    return useQuery({
        queryKey: queryKeys.clinicalInterventions.analytics.trends(dateRange),
        queryFn: () => clinicalInterventionService.getOutcomeTrends(dateRange),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// ===============================
// MUTATION HOOKS
// ===============================

/**
 * Hook to create a new intervention
 */
export const useCreateIntervention = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: CreateInterventionData) =>
            clinicalInterventionService.createIntervention(data),
        onSuccess: (response, variables) => {
            // Invalidate and refetch interventions lists
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            // Invalidate patient-specific interventions if patientId is provided
            if (variables.patientId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.clinicalInterventions.byPatient(variables.patientId),
                });
            }

            // Invalidate analytics
            queryClient.invalidateQueries({
                queryKey: queryKeys.clinicalInterventions.analytics.all,
            });

            // Show success notification
            const intervention = response?.data;
            addNotification({
                type: 'success',
                title: 'Intervention Created',
                message: `Clinical intervention ${intervention?.interventionNumber || ''} has been successfully created.`,
                duration: 5000,
            });
        },
        onError: (error: ApiError) => {
            // Show error notification
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
 * Hook to update an intervention
 */
export const useUpdateIntervention = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            updates,
        }: {
            interventionId: string;
            updates: UpdateInterventionData;
        }) => clinicalInterventionService.updateIntervention(interventionId, updates),
        onSuccess: (response, variables) => {
            // Update the specific intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate interventions lists to reflect changes
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            // Invalidate analytics if status changed
            if (variables.updates.status) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.clinicalInterventions.analytics.all,
                });
            }

            // Show success notification
            addNotification({
                type: 'success',
                title: 'Intervention Updated',
                message: 'Intervention has been successfully updated.',
                duration: 5000,
            });
        },
        onError: (error: ApiError) => {
            // Show error notification
            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update intervention. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to delete an intervention
 */
export const useDeleteIntervention = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (interventionId: string) =>
            clinicalInterventionService.deleteIntervention(interventionId),
        onSuccess: (_, interventionId) => {
            // Remove intervention from cache
            queryClient.removeQueries({
                queryKey: queryKeys.clinicalInterventions.detail(interventionId),
            });

            // Invalidate interventions lists
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            // Invalidate analytics
            queryClient.invalidateQueries({
                queryKey: queryKeys.clinicalInterventions.analytics.all,
            });

            // Show success notification
            addNotification({
                type: 'success',
                title: 'Intervention Deleted',
                message: 'Intervention has been successfully deleted.',
                duration: 5000,
            });
        },
        onError: (error: ApiError) => {
            // Show error notification
            addNotification({
                type: 'error',
                title: 'Deletion Failed',
                message: error.message || 'Failed to delete intervention. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// WORKFLOW MUTATION HOOKS
// ===============================

/**
 * Hook to add a strategy to an intervention
 */
export const useAddStrategy = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            strategy,
        }: {
            interventionId: string;
            strategy: Omit<InterventionStrategy, '_id'>;
        }) => clinicalInterventionService.addStrategy(interventionId, strategy),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists to reflect changes
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            // Show success notification
            addNotification({
                type: 'success',
                title: 'Strategy Added',
                message: 'Intervention strategy has been successfully added.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Failed to Add Strategy',
                message: error.message || 'Unable to add strategy. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update a strategy
 */
export const useUpdateStrategy = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            strategyId,
            updates,
        }: {
            interventionId: string;
            strategyId: string;
            updates: Partial<InterventionStrategy>;
        }) => clinicalInterventionService.updateStrategy(interventionId, strategyId, updates),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            addNotification({
                type: 'success',
                title: 'Strategy Updated',
                message: 'Strategy has been successfully updated.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update strategy.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to assign a team member
 */
export const useAssignTeamMember = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            assignment,
        }: {
            interventionId: string;
            assignment: Omit<TeamAssignment, '_id' | 'assignedAt'>;
        }) => clinicalInterventionService.assignTeamMember(interventionId, assignment),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists and assigned interventions
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.assignedToMe() });

            addNotification({
                type: 'success',
                title: 'Team Member Assigned',
                message: 'Team member has been successfully assigned.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Assignment Failed',
                message: error.message || 'Failed to assign team member.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update an assignment
 */
export const useUpdateAssignment = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            assignmentId,
            updates,
        }: {
            interventionId: string;
            assignmentId: string;
            updates: Partial<TeamAssignment>;
        }) => clinicalInterventionService.updateAssignment(interventionId, assignmentId, updates),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists and assigned interventions
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.assignedToMe() });

            // Invalidate analytics if assignment status changed
            if (updates.status) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.clinicalInterventions.analytics.all,
                });
            }

            addNotification({
                type: 'success',
                title: 'Assignment Updated',
                message: 'Assignment has been successfully updated.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update assignment.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to record intervention outcome
 */
export const useRecordOutcome = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            outcome,
        }: {
            interventionId: string;
            outcome: InterventionOutcome;
        }) => clinicalInterventionService.recordOutcome(interventionId, outcome),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists and analytics
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });
            queryClient.invalidateQueries({
                queryKey: queryKeys.clinicalInterventions.analytics.all,
            });

            addNotification({
                type: 'success',
                title: 'Outcome Recorded',
                message: 'Intervention outcome has been successfully recorded.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Failed to Record Outcome',
                message: error.message || 'Unable to record outcome.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to schedule follow-up
 */
export const useScheduleFollowUp = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            followUpData,
        }: {
            interventionId: string;
            followUpData: { scheduledDate: string; notes?: string; nextReviewDate?: string };
        }) => clinicalInterventionService.scheduleFollowUp(interventionId, followUpData),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            addNotification({
                type: 'success',
                title: 'Follow-up Scheduled',
                message: 'Follow-up has been successfully scheduled.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Scheduling Failed',
                message: error.message || 'Failed to schedule follow-up.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// INTEGRATION HOOKS
// ===============================

/**
 * Hook to link intervention to MTR
 */
export const useLinkToMTR = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            mtrId,
        }: {
            interventionId: string;
            mtrId: string;
        }) => clinicalInterventionService.linkToMTR(interventionId, mtrId),
        onSuccess: (response, variables) => {
            // Update the intervention in cache
            queryClient.setQueryData(
                queryKeys.clinicalInterventions.detail(variables.interventionId),
                response
            );

            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.clinicalInterventions.lists() });

            addNotification({
                type: 'success',
                title: 'MTR Linked',
                message: 'Intervention has been successfully linked to MTR.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Link Failed',
                message: error.message || 'Failed to link to MTR.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to send notifications
 */
export const useSendNotifications = () => {
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({
            interventionId,
            event,
        }: {
            interventionId: string;
            event: string;
        }) => clinicalInterventionService.sendNotifications(interventionId, event),
        onSuccess: () => {
            addNotification({
                type: 'success',
                title: 'Notifications Sent',
                message: 'Notifications have been successfully sent.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Notification Failed',
                message: error.message || 'Failed to send notifications.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook for optimistic updates when creating interventions
 */
export const useOptimisticCreateIntervention = () => {
    const queryClient = useQueryClient();
    const createMutation = useCreateIntervention();

    return {
        ...createMutation,
        mutateAsync: async (data: CreateInterventionData) => {
            // Create optimistic intervention
            const optimisticIntervention: Partial<ClinicalIntervention> = {
                _id: `temp-${Date.now()}`,
                patientId: data.patientId,
                category: data.category,
                priority: data.priority,
                issueDescription: data.issueDescription,
                status: 'identified',
                strategies: data.strategies || [],
                assignments: [],
                followUp: { required: false },
                relatedDTPIds: data.relatedDTPIds || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Optimistically update the cache
            const previousData = queryClient.getQueryData(queryKeys.clinicalInterventions.lists());

            queryClient.setQueryData(queryKeys.clinicalInterventions.lists(), (old: any) => {
                if (!old?.data?.data) return old;
                return {
                    ...old,
                    data: {
                        ...old.data,
                        data: [optimisticIntervention, ...old.data.data],
                    },
                };
            });

            try {
                // Perform the actual mutation
                const result = await createMutation.mutateAsync(data);
                return result;
            } catch (error) {
                // Revert optimistic update on error
                queryClient.setQueryData(queryKeys.clinicalInterventions.lists(), previousData);
                throw error;
            }
        },
    };
};

/**
 * Hook to prefetch intervention details
 */
export const usePrefetchIntervention = () => {
    const queryClient = useQueryClient();

    return (interventionId: string) => {
        queryClient.prefetchQuery({
            queryKey: queryKeys.clinicalInterventions.detail(interventionId),
            queryFn: () => clinicalInterventionService.getInterventionById(interventionId),
            staleTime: 2 * 60 * 1000, // 2 minutes
        });
    };
};