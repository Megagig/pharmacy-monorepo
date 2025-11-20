import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LoadingState, ErrorState } from './types';

// ===============================
// TYPES AND INTERFACES
// ===============================

export interface ClinicalIntervention {
    _id: string;
    workplaceId: string;
    patientId: string;
    interventionNumber: string;
    category: 'drug_therapy_problem' | 'adverse_drug_reaction' | 'medication_nonadherence' | 'drug_interaction' | 'dosing_issue' | 'contraindication' | 'other';
    priority: 'low' | 'medium' | 'high' | 'critical';
    issueDescription: string;
    identifiedDate: string;
    identifiedBy: string;
    status: 'identified' | 'planning' | 'in_progress' | 'implemented' | 'completed' | 'cancelled';

    // Strategy information
    strategies: InterventionStrategy[];

    // Team collaboration
    assignments: TeamAssignment[];

    // Implementation tracking
    implementationNotes?: string;

    // Outcome measurement
    outcomes?: InterventionOutcome;

    // Follow-up and monitoring
    followUp: {
        required: boolean;
        scheduledDate?: string;
        completedDate?: string;
        notes?: string;
        nextReviewDate?: string;
    };

    // Timestamps
    startedAt: string;
    completedAt?: string;
    estimatedDuration?: number;
    actualDuration?: number;

    // Integration references
    relatedMTRId?: string;
    relatedDTPIds: string[];

    // Populated fields (from API)
    patient?: {
        _id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        phoneNumber?: string;
        email?: string;
    };

    identifiedByUser?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
    };

    // Audit fields
    createdBy: string;
    updatedBy?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface InterventionStrategy {
    _id?: string;
    type: 'medication_review' | 'dose_adjustment' | 'alternative_therapy' | 'discontinuation' | 'additional_monitoring' | 'patient_counseling' | 'physician_consultation' | 'custom';
    description: string;
    rationale: string;
    expectedOutcome: string;
    priority: 'primary' | 'secondary';
    status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
    implementedAt?: string;
    implementedBy?: string;
    notes?: string;
}

export interface TeamAssignment {
    _id?: string;
    userId: string;
    role: 'pharmacist' | 'physician' | 'nurse' | 'patient' | 'caregiver';
    task: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    assignedAt: string;
    completedAt?: string;
    notes?: string;

    // Populated user info
    user?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    };
}

export interface InterventionOutcome {
    patientResponse: 'improved' | 'no_change' | 'worsened' | 'unknown';
    clinicalParameters: Array<{
        parameter: string;
        beforeValue?: string;
        afterValue?: string;
        unit?: string;
        improvementPercentage?: number;
    }>;
    adverseEffects?: string;
    additionalIssues?: string;
    successMetrics: {
        problemResolved: boolean;
        medicationOptimized: boolean;
        adherenceImproved: boolean;
        costSavings?: number;
        qualityOfLifeImproved?: boolean;
    };
}

export interface CreateInterventionData {
    patientId: string;
    category: ClinicalIntervention['category'];
    priority: ClinicalIntervention['priority'];
    issueDescription: string;
    strategies?: Omit<InterventionStrategy, '_id' | 'status' | 'implementedAt' | 'implementedBy' | 'notes'>[];
    estimatedDuration?: number;
    relatedMTRId?: string;
    relatedDTPIds?: string[];
}

export interface UpdateInterventionData {
    category?: ClinicalIntervention['category'];
    priority?: ClinicalIntervention['priority'];
    issueDescription?: string;
    status?: ClinicalIntervention['status'];
    implementationNotes?: string;
    estimatedDuration?: number;
    outcomes?: InterventionOutcome;
    followUp?: {
        required?: boolean;
        scheduledDate?: string;
        notes?: string;
        nextReviewDate?: string;
    };
}

export interface InterventionFilters {
    patientId?: string;
    category?: ClinicalIntervention['category'];
    priority?: ClinicalIntervention['priority'];
    status?: ClinicalIntervention['status'];
    identifiedBy?: string;
    assignedTo?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface StrategyRecommendation {
    type: string;
    label: string;
    description: string;
    rationale: string;
    expectedOutcome: string;
    priority: 'primary' | 'secondary';
    applicableCategories: string[];
}

export interface DashboardMetrics {
    totalInterventions: number;
    activeInterventions: number;
    completedInterventions: number;
    overdueInterventions: number;
    successRate: number;
    averageResolutionTime: number;
    totalCostSavings: number;
    categoryDistribution: Array<{
        name: string;
        value: number;
        successRate: number;
        color: string;
    }>;
    priorityDistribution: Array<{
        name: string;
        value: number;
        color: string;
    }>;
    monthlyTrends: Array<{
        month: string;
        total: number;
        completed: number;
        successRate: number;
    }>;
    recentInterventions: Array<{
        _id: string;
        interventionNumber: string;
        category: string;
        priority: string;
        status: string;
        patientName: string;
        identifiedDate: string;
        assignedTo?: string;
    }>;
}

// ===============================
// STORE INTERFACE
// ===============================

interface ClinicalInterventionStore {
    // State
    interventions: ClinicalIntervention[];
    selectedIntervention: ClinicalIntervention | null;
    filters: InterventionFilters;
    loading: LoadingState;
    errors: ErrorState;
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };

    // UI State
    activeStep: number;
    showCreateModal: boolean;
    showDetailsModal: boolean;
    selectedPatient: {
        _id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
    } | null;

    // Dashboard metrics
    dashboardMetrics: DashboardMetrics | null;

    // Strategy recommendations
    strategyRecommendations: StrategyRecommendation[];

    // CRUD Actions
    fetchInterventions: (filters?: InterventionFilters) => Promise<void>;
    createIntervention: (data: CreateInterventionData) => Promise<ClinicalIntervention | null>;
    updateIntervention: (id: string, updates: UpdateInterventionData) => Promise<ClinicalIntervention | null>;
    deleteIntervention: (id: string) => Promise<boolean>;
    getInterventionById: (id: string) => Promise<ClinicalIntervention | null>;

    // Workflow Actions
    addStrategy: (interventionId: string, strategy: Omit<InterventionStrategy, '_id'>) => Promise<void>;
    updateStrategy: (interventionId: string, strategyId: string, updates: Partial<InterventionStrategy>) => Promise<void>;
    assignTeamMember: (interventionId: string, assignment: Omit<TeamAssignment, '_id' | 'assignedAt'>) => Promise<void>;
    updateAssignment: (interventionId: string, assignmentId: string, updates: Partial<TeamAssignment>) => Promise<void>;
    recordOutcome: (interventionId: string, outcome: InterventionOutcome) => Promise<void>;
    scheduleFollowUp: (interventionId: string, followUpData: { scheduledDate: string; notes?: string; nextReviewDate?: string }) => Promise<void>;

    // Search and Analytics
    searchInterventions: (query: string) => Promise<void>;
    getPatientInterventions: (patientId: string) => Promise<void>;
    getMyAssignedInterventions: () => Promise<void>;
    fetchDashboardMetrics: (dateRange?: { from: Date; to: Date }) => Promise<void>;
    refreshDashboard: () => Promise<void>;
    getStrategyRecommendations: (category: string) => Promise<void>;

    // UI Actions
    setActiveStep: (step: number) => void;
    selectIntervention: (intervention: ClinicalIntervention | null) => void;
    selectPatient: (patient: ClinicalInterventionStore['selectedPatient']) => void;
    setFilters: (filters: Partial<InterventionFilters>) => void;
    clearFilters: () => void;
    setShowCreateModal: (show: boolean) => void;
    setShowDetailsModal: (show: boolean) => void;

    // Pagination Actions
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;

    // Utility Actions
    clearErrors: () => void;
    setLoading: (key: string, loading: boolean) => void;
    setError: (key: string, error: string | null) => void;

    // Local State Management
    addInterventionToState: (intervention: ClinicalIntervention) => void;
    updateInterventionInState: (id: string, updates: Partial<ClinicalIntervention>) => void;
    removeInterventionFromState: (id: string) => void;
}

// ===============================
// STORE IMPLEMENTATION
// ===============================

export const useClinicalInterventionStore = create<ClinicalInterventionStore>()(
    persist(
        (set, get) => ({
            // Initial state
            interventions: [],
            selectedIntervention: null,
            filters: {
                search: '',
                sortBy: 'identifiedDate',
                sortOrder: 'desc',
                page: 1,
                limit: 20,
            },
            loading: {},
            errors: {},
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0,
                hasNext: false,
                hasPrev: false,
            },

            // UI State
            activeStep: 0,
            showCreateModal: false,
            showDetailsModal: false,
            selectedPatient: null,
            dashboardMetrics: null,
            strategyRecommendations: [],

            // CRUD Operations
            fetchInterventions: async (filters) => {
                const { setLoading, setError } = get();
                setLoading('fetchInterventions', true);
                setError('fetchInterventions', null);

                try {
                    const currentFilters = filters || get().filters;

                    // Import the service dynamically to avoid circular dependencies
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.getInterventions(currentFilters);

                    if (response.success && response.data) {
                        set({
                            interventions: response.data.data || [],
                            pagination: response.data.pagination || {
                                page: currentFilters.page || 1,
                                limit: currentFilters.limit || 20,
                                total: 0,
                                pages: 0,
                                hasNext: false,
                                hasPrev: false,
                            },
                        });
                    } else {
                        setError('fetchInterventions', response.message || 'Failed to fetch interventions');
                        // Set empty state on error
                        set({
                            interventions: [],
                            pagination: {
                                page: 1,
                                limit: 20,
                                total: 0,
                                pages: 0,
                                hasNext: false,
                                hasPrev: false,
                            },
                        });
                    }
                } catch (error) {
                    console.error('Error fetching interventions:', error);
                    setError('fetchInterventions', error instanceof Error ? error.message : 'An unexpected error occurred');

                    // Set empty state on error
                    set({
                        interventions: [],
                        pagination: {
                            page: 1,
                            limit: 20,
                            total: 0,
                            pages: 0,
                            hasNext: false,
                            hasPrev: false,
                        },
                    });
                } finally {
                    setLoading('fetchInterventions', false);
                }
            },

            createIntervention: async (data) => {
                const { setLoading, setError, addInterventionToState } = get();
                setLoading('createIntervention', true);
                setError('createIntervention', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.createIntervention(data);

                    if (response.success && response.data) {
                        addInterventionToState(response.data);
                        return response.data;
                    } else {
                        setError('createIntervention', response.message || 'Failed to create intervention');
                        return null;
                    }
                } catch (error) {
                    setError('createIntervention', error instanceof Error ? error.message : 'An unexpected error occurred');
                    return null;
                } finally {
                    setLoading('createIntervention', false);
                }
            },

            updateIntervention: async (id, updates) => {
                const { setLoading, setError, updateInterventionInState } = get();
                setLoading('updateIntervention', true);
                setError('updateIntervention', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.updateIntervention(id, updates);

                    if (response.success && response.data) {
                        updateInterventionInState(id, response.data);

                        // Update selected intervention if it's the one being updated
                        const { selectedIntervention } = get();
                        if (selectedIntervention && selectedIntervention._id === id) {
                            set({ selectedIntervention: response.data });
                        }

                        return response.data;
                    } else {
                        setError('updateIntervention', response.message || 'Failed to update intervention');
                        return null;
                    }
                } catch (error) {
                    setError('updateIntervention', error instanceof Error ? error.message : 'An unexpected error occurred');
                    return null;
                } finally {
                    setLoading('updateIntervention', false);
                }
            },

            deleteIntervention: async (id) => {
                const { setLoading, setError, removeInterventionFromState } = get();
                setLoading('deleteIntervention', true);
                setError('deleteIntervention', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.deleteIntervention(id);

                    if (response.success) {
                        removeInterventionFromState(id);

                        // Clear selected intervention if it's the one being deleted
                        const { selectedIntervention } = get();
                        if (selectedIntervention && selectedIntervention._id === id) {
                            set({ selectedIntervention: null });
                        }

                        return true;
                    } else {
                        setError('deleteIntervention', response.message || 'Failed to delete intervention');
                        return false;
                    }
                } catch (error) {
                    setError('deleteIntervention', error instanceof Error ? error.message : 'An unexpected error occurred');
                    return false;
                } finally {
                    setLoading('deleteIntervention', false);
                }
            },

            getInterventionById: async (id) => {
                const { setLoading, setError } = get();
                setLoading('getInterventionById', true);
                setError('getInterventionById', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.getInterventionById(id);

                    if (response.success && response.data) {
                        return response.data;
                    } else {
                        setError('getInterventionById', response.message || 'Failed to fetch intervention');
                        return null;
                    }
                } catch (error) {
                    setError('getInterventionById', error instanceof Error ? error.message : 'An unexpected error occurred');
                    return null;
                } finally {
                    setLoading('getInterventionById', false);
                }
            },

            // Workflow Actions
            addStrategy: async (interventionId, strategy) => {
                const { setLoading, setError } = get();
                setLoading('addStrategy', true);
                setError('addStrategy', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.addStrategy(interventionId, strategy);

                    if (response.success && response.data) {
                        // Update the intervention in state
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('addStrategy', response.message || 'Failed to add strategy');
                    }
                } catch (error) {
                    setError('addStrategy', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('addStrategy', false);
                }
            },

            updateStrategy: async (interventionId, strategyId, updates) => {
                const { setLoading, setError } = get();
                setLoading('updateStrategy', true);
                setError('updateStrategy', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.updateStrategy(interventionId, strategyId, updates);

                    if (response.success && response.data) {
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('updateStrategy', response.message || 'Failed to update strategy');
                    }
                } catch (error) {
                    setError('updateStrategy', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('updateStrategy', false);
                }
            },

            assignTeamMember: async (interventionId, assignment) => {
                const { setLoading, setError } = get();
                setLoading('assignTeamMember', true);
                setError('assignTeamMember', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.assignTeamMember(interventionId, assignment);

                    if (response.success && response.data) {
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('assignTeamMember', response.message || 'Failed to assign team member');
                    }
                } catch (error) {
                    setError('assignTeamMember', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('assignTeamMember', false);
                }
            },

            updateAssignment: async (interventionId, assignmentId, updates) => {
                const { setLoading, setError } = get();
                setLoading('updateAssignment', true);
                setError('updateAssignment', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.updateAssignment(interventionId, assignmentId, updates);

                    if (response.success && response.data) {
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('updateAssignment', response.message || 'Failed to update assignment');
                    }
                } catch (error) {
                    setError('updateAssignment', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('updateAssignment', false);
                }
            },

            recordOutcome: async (interventionId, outcome) => {
                const { setLoading, setError } = get();
                setLoading('recordOutcome', true);
                setError('recordOutcome', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.recordOutcome(interventionId, outcome);

                    if (response.success && response.data) {
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('recordOutcome', response.message || 'Failed to record outcome');
                    }
                } catch (error) {
                    setError('recordOutcome', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('recordOutcome', false);
                }
            },

            scheduleFollowUp: async (interventionId, followUpData) => {
                const { setLoading, setError } = get();
                setLoading('scheduleFollowUp', true);
                setError('scheduleFollowUp', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.scheduleFollowUp(interventionId, followUpData);

                    if (response.success && response.data) {
                        const { updateInterventionInState } = get();
                        updateInterventionInState(interventionId, response.data);
                    } else {
                        setError('scheduleFollowUp', response.message || 'Failed to schedule follow-up');
                    }
                } catch (error) {
                    setError('scheduleFollowUp', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('scheduleFollowUp', false);
                }
            },

            // Search and Analytics
            searchInterventions: async (query) => {
                const { setFilters, fetchInterventions } = get();
                setFilters({ search: query, page: 1 });
                await fetchInterventions();
            },

            getPatientInterventions: async (patientId) => {
                const { setFilters, fetchInterventions } = get();
                setFilters({ patientId, page: 1 });
                await fetchInterventions();
            },

            getMyAssignedInterventions: async () => {
                const { setLoading, setError } = get();
                setLoading('getMyAssignedInterventions', true);
                setError('getMyAssignedInterventions', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.getMyAssignedInterventions();

                    if (response.success && response.data) {
                        set({ interventions: response.data });
                    } else {
                        setError('getMyAssignedInterventions', response.message || 'Failed to fetch assigned interventions');
                    }
                } catch (error) {
                    setError('getMyAssignedInterventions', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('getMyAssignedInterventions', false);
                }
            },

            fetchDashboardMetrics: async (dateRange) => {
                const { setLoading, setError } = get();
                setLoading('fetchDashboardMetrics', true);
                setError('fetchDashboardMetrics', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.getDashboardMetrics(dateRange);

                    if (response.success && response.data) {
                        set({ dashboardMetrics: response.data });
                    } else {
                        setError('fetchDashboardMetrics', response.message || 'Failed to fetch dashboard metrics');
                        set({ dashboardMetrics: null });
                    }
                } catch (error) {
                    console.error('Error fetching dashboard metrics:', error);
                    setError('fetchDashboardMetrics', error instanceof Error ? error.message : 'An unexpected error occurred');
                    set({ dashboardMetrics: null });
                } finally {
                    setLoading('fetchDashboardMetrics', false);
                }
            },

            refreshDashboard: async () => {
                const { fetchDashboardMetrics } = get();
                await fetchDashboardMetrics();
            },

            getStrategyRecommendations: async (category) => {
                const { setLoading, setError } = get();
                setLoading('getStrategyRecommendations', true);
                setError('getStrategyRecommendations', null);

                try {
                    const { clinicalInterventionService } = await import('../services/clinicalInterventionService');
                    const response = await clinicalInterventionService.getStrategyRecommendations(category);

                    if (response.success && response.data) {
                        set({ strategyRecommendations: response.data });
                    } else {
                        setError('getStrategyRecommendations', response.message || 'Failed to fetch strategy recommendations');
                    }
                } catch (error) {
                    setError('getStrategyRecommendations', error instanceof Error ? error.message : 'An unexpected error occurred');
                } finally {
                    setLoading('getStrategyRecommendations', false);
                }
            },

            // UI Actions
            setActiveStep: (step) => set({ activeStep: step }),

            selectIntervention: (intervention) => set({ selectedIntervention: intervention }),

            selectPatient: (patient) => set({ selectedPatient: patient }),

            setFilters: (newFilters) =>
                set((state) => ({
                    filters: { ...state.filters, ...newFilters },
                })),

            clearFilters: () =>
                set({
                    filters: {
                        search: '',
                        sortBy: 'identifiedDate',
                        sortOrder: 'desc',
                        page: 1,
                        limit: 20,
                    },
                }),

            setShowCreateModal: (show) => set({ showCreateModal: show }),

            setShowDetailsModal: (show) => set({ showDetailsModal: show }),

            // Pagination Actions
            setPage: (page) => {
                const { setFilters, fetchInterventions } = get();
                setFilters({ page });
                fetchInterventions();
            },

            setLimit: (limit) => {
                const { setFilters, fetchInterventions } = get();
                setFilters({ limit, page: 1 });
                fetchInterventions();
            },

            // Utility Actions
            clearErrors: () => set({ errors: {} }),

            setLoading: (key, loading) =>
                set((state) => ({
                    loading: { ...state.loading, [key]: loading },
                })),

            setError: (key, error) =>
                set((state) => ({
                    errors: { ...state.errors, [key]: error },
                })),

            // Local State Management
            addInterventionToState: (intervention) =>
                set((state) => ({
                    interventions: [intervention, ...state.interventions],
                    pagination: {
                        ...state.pagination,
                        total: state.pagination.total + 1,
                    },
                })),

            updateInterventionInState: (id, updates) =>
                set((state) => ({
                    interventions: state.interventions.map(i =>
                        i._id === id ? { ...i, ...updates } : i
                    ),
                })),

            removeInterventionFromState: (id) =>
                set((state) => ({
                    interventions: state.interventions.filter(i => i._id !== id),
                    pagination: {
                        ...state.pagination,
                        total: Math.max(0, state.pagination.total - 1),
                    },
                })),
        }),
        {
            name: 'clinical-intervention-store',
            partialize: (state) => ({
                filters: state.filters,
                selectedIntervention: state.selectedIntervention,
                selectedPatient: state.selectedPatient,
                activeStep: state.activeStep,
            }),
        }
    )
);

// ===============================
// UTILITY HOOKS
// ===============================

// Hook for interventions list with loading and error states
export const useInterventions = () => useClinicalInterventionStore((state) => ({
    interventions: state.interventions,
    loading: state.loading.fetchInterventions || false,
    error: state.errors.fetchInterventions || null,
    pagination: state.pagination,
    fetchInterventions: state.fetchInterventions,
}));

// Hook for selected intervention
export const useSelectedIntervention = () => useClinicalInterventionStore((state) => ({
    selectedIntervention: state.selectedIntervention,
    selectIntervention: state.selectIntervention,
    loading: state.loading.getInterventionById || false,
    error: state.errors.getInterventionById || null,
    getInterventionById: state.getInterventionById,
}));

// Hook for intervention filters
export const useInterventionFilters = () => useClinicalInterventionStore((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
    clearFilters: state.clearFilters,
    searchInterventions: state.searchInterventions,
}));

// Hook for intervention actions (CRUD)
export const useInterventionActions = () => useClinicalInterventionStore((state) => ({
    createIntervention: state.createIntervention,
    updateIntervention: state.updateIntervention,
    deleteIntervention: state.deleteIntervention,
    loading: {
        create: state.loading.createIntervention || false,
        update: state.loading.updateIntervention || false,
        delete: state.loading.deleteIntervention || false,
    },
    errors: {
        create: state.errors.createIntervention || null,
        update: state.errors.updateIntervention || null,
        delete: state.errors.deleteIntervention || null,
    },
    clearErrors: state.clearErrors,
}));

// Hook for workflow actions
export const useInterventionWorkflow = () => useClinicalInterventionStore((state) => ({
    addStrategy: state.addStrategy,
    updateStrategy: state.updateStrategy,
    assignTeamMember: state.assignTeamMember,
    updateAssignment: state.updateAssignment,
    recordOutcome: state.recordOutcome,
    scheduleFollowUp: state.scheduleFollowUp,
    loading: {
        addStrategy: state.loading.addStrategy || false,
        updateStrategy: state.loading.updateStrategy || false,
        assignTeamMember: state.loading.assignTeamMember || false,
        updateAssignment: state.loading.updateAssignment || false,
        recordOutcome: state.loading.recordOutcome || false,
        scheduleFollowUp: state.loading.scheduleFollowUp || false,
    },
    errors: {
        addStrategy: state.errors.addStrategy || null,
        updateStrategy: state.errors.updateStrategy || null,
        assignTeamMember: state.errors.assignTeamMember || null,
        updateAssignment: state.errors.updateAssignment || null,
        recordOutcome: state.errors.recordOutcome || null,
        scheduleFollowUp: state.errors.scheduleFollowUp || null,
    },
}));

// Hook for UI state management
export const useInterventionUI = () => useClinicalInterventionStore((state) => ({
    activeStep: state.activeStep,
    showCreateModal: state.showCreateModal,
    showDetailsModal: state.showDetailsModal,
    selectedPatient: state.selectedPatient,
    setActiveStep: state.setActiveStep,
    setShowCreateModal: state.setShowCreateModal,
    setShowDetailsModal: state.setShowDetailsModal,
    selectPatient: state.selectPatient,
}));

// Hook for dashboard and analytics
export const useInterventionAnalytics = () => useClinicalInterventionStore((state) => ({
    dashboardMetrics: state.dashboardMetrics,
    strategyRecommendations: state.strategyRecommendations,
    fetchDashboardMetrics: state.fetchDashboardMetrics,
    getStrategyRecommendations: state.getStrategyRecommendations,
    loading: {
        dashboardMetrics: state.loading.fetchDashboardMetrics || false,
        strategyRecommendations: state.loading.getStrategyRecommendations || false,
    },
    errors: {
        dashboardMetrics: state.errors.fetchDashboardMetrics || null,
        strategyRecommendations: state.errors.getStrategyRecommendations || null,
    },
}));