import { QueryClient } from '@tanstack/react-query';

// Create a new QueryClient instance with optimized configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Optimized stale time based on data type
      staleTime: 5 * 60 * 1000, // 5 minutes for most data
      // Optimized garbage collection time
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Smart retry strategy
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Don't retry on network errors in offline mode
        if (!navigator.onLine) {
          return false;
        }
        // Retry up to 3 times for server errors
        return failureCount < 3;
      },
      // Exponential backoff with jitter
      retryDelay: (attemptIndex) => {
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        const jitter = Math.random() * 0.1 * baseDelay;
        return baseDelay + jitter;
      },
      // Smart refetch on window focus
      refetchOnWindowFocus: (query) => {
        // Only refetch critical data on focus
        const criticalKeys = ['dashboard', 'notifications', 'active-interventions', 'pending-orders'];
        return criticalKeys.some(key => query.queryKey.includes(key));
      },
      // Always refetch on reconnect
      refetchOnReconnect: 'always',
      // Enable background refetch for better UX
      refetchInterval: false, // Will be set per query as needed
      // Network mode for offline support
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once with delay
      retry: 1,
      retryDelay: 1000,
      // Network mode for mutations
      networkMode: 'online',
    },
  },
});

// Query Keys Factory - Centralized query key management for Patient Management
// Using a functional approach to avoid circular references

// Base query key generators
const createBaseKeys = (entity: string) => ({
  all: [entity] as const,
  lists: () => [entity, 'list'] as const,
  list: (filters: Record<string, unknown>) => [entity, 'list', { filters }] as const,
  details: () => [entity, 'detail'] as const,
  detail: (id: string) => [entity, 'detail', id] as const,
});

const createPatientRelatedKeys = (entity: string) => ({
  ...createBaseKeys(entity),
  byPatient: (patientId: string) => [entity, 'patient', patientId] as const,
});

export const queryKeys = {
  // Patient queries
  patients: {
    ...createBaseKeys('patients'),
    search: (query: string) => ['patients', 'search', query] as const,
    summary: (id: string) => ['patients', 'summary', id] as const,
  },

  // Allergy queries
  allergies: createPatientRelatedKeys('allergies'),

  // Condition queries
  conditions: createPatientRelatedKeys('conditions'),

  // Medication queries
  medications: {
    ...createPatientRelatedKeys('medications'),
    current: (patientId: string) => ['medications', 'patient', patientId, 'current'] as const,
    past: (patientId: string) => ['medications', 'patient', patientId, 'past'] as const,
  },

  // Clinical Assessment queries
  assessments: {
    ...createPatientRelatedKeys('assessments'),
    latest: (patientId: string) => ['assessments', 'patient', patientId, 'latest'] as const,
  },

  // Drug Therapy Problem queries
  dtps: {
    ...createPatientRelatedKeys('dtps'),
    active: (patientId: string) => ['dtps', 'patient', patientId, 'active'] as const,
  },

  // Care Plan queries
  carePlans: {
    ...createPatientRelatedKeys('carePlans'),
    latest: (patientId: string) => ['carePlans', 'patient', patientId, 'latest'] as const,
  },

  // Visit queries
  visits: {
    ...createPatientRelatedKeys('visits'),
    attachments: (visitId: string) => ['visits', 'detail', visitId, 'attachments'] as const,
  },

  // Clinical Notes queries (legacy support)
  clinicalNotes: createPatientRelatedKeys('clinicalNotes'),

  // MTR (Medication Therapy Review) queries
  mtr: {
    ...createPatientRelatedKeys('mtr'),
    active: () => ['mtr', 'active'] as const,
    overdue: () => ['mtr', 'overdue'] as const,
    statistics: (dateRange?: { start: string; end: string }) =>
      ['mtr', 'statistics', dateRange] as const,
    workflowSteps: () => ['mtr', 'workflow', 'steps'] as const,
  },

  // Drug Therapy Problems queries
  drugTherapyProblems: {
    ...createPatientRelatedKeys('drugTherapyProblems'),
    byReview: (reviewId: string) => ['drugTherapyProblems', 'review', reviewId] as const,
    active: () => ['drugTherapyProblems', 'active'] as const,
    statistics: (dateRange?: { start: string; end: string }) =>
      ['drugTherapyProblems', 'statistics', dateRange] as const,
  },

  // MTR Interventions queries
  mtrInterventions: {
    ...createPatientRelatedKeys('mtrInterventions'),
    byReview: (reviewId: string) => ['mtrInterventions', 'review', reviewId] as const,
    pending: () => ['mtrInterventions', 'pending'] as const,
    statistics: (dateRange?: { start: string; end: string }) =>
      ['mtrInterventions', 'statistics', dateRange] as const,
  },

  // MTR Follow-ups queries
  mtrFollowUps: {
    ...createPatientRelatedKeys('mtrFollowUps'),
    byReview: (reviewId: string) => ['mtrFollowUps', 'review', reviewId] as const,
    scheduled: () => ['mtrFollowUps', 'scheduled'] as const,
    overdue: () => ['mtrFollowUps', 'overdue'] as const,
    statistics: (dateRange?: { start: string; end: string }) =>
      ['mtrFollowUps', 'statistics', dateRange] as const,
  },

  // Clinical Interventions queries
  clinicalInterventions: {
    ...createPatientRelatedKeys('clinicalInterventions'),
    assignedToMe: () => ['clinicalInterventions', 'assigned-to-me'] as const,
    search: (query: string) => ['clinicalInterventions', 'search', query] as const,
    analytics: {
      all: ['clinicalInterventions', 'analytics'] as const,
      dashboard: (dateRange?: { start: string; end: string }) =>
        ['clinicalInterventions', 'analytics', 'dashboard', dateRange] as const,
      trends: (dateRange?: { start: string; end: string }) =>
        ['clinicalInterventions', 'analytics', 'trends', dateRange] as const,
      categories: () => ['clinicalInterventions', 'analytics', 'categories'] as const,
      priorities: () => ['clinicalInterventions', 'analytics', 'priorities'] as const,
    },
    recommendations: (category: string) =>
      ['clinicalInterventions', 'recommendations', category] as const,
    duplicates: (patientId: string, category: string) =>
      ['clinicalInterventions', 'duplicates', patientId, category] as const,
  },

  // Diagnostics queries
  diagnostics: {
    all: ['diagnostics'] as const,
    requests: () => ['diagnostics', 'requests'] as const,
    request: (id: string) => ['diagnostics', 'request', id] as const,
    results: () => ['diagnostics', 'results'] as const,
    result: (requestId: string) => ['diagnostics', 'result', requestId] as const,
    history: (params: Record<string, unknown>) => ['diagnostics', 'history', params] as const,
    analytics: (params?: Record<string, unknown>) => ['diagnostics', 'analytics', params] as const,
    status: (requestId: string) => ['diagnostics', 'status', requestId] as const,
  },

  // Lab queries
  lab: {
    orders: {
      all: ['lab', 'orders'] as const,
      lists: () => ['lab', 'orders', 'list'] as const,
      list: (params: Record<string, unknown>) => ['lab', 'orders', 'list', params] as const,
      detail: (id: string) => ['lab', 'orders', 'detail', id] as const,
      byPatient: (patientId: string) => ['lab', 'orders', 'patient', patientId] as const,
      pending: () => ['lab', 'orders', 'pending'] as const,
      completed: () => ['lab', 'orders', 'completed'] as const,
    },
    results: {
      all: ['lab', 'results'] as const,
      lists: () => ['lab', 'results', 'list'] as const,
      list: (params: Record<string, unknown>) => ['lab', 'results', 'list', params] as const,
      detail: (id: string) => ['lab', 'results', 'detail', id] as const,
      byPatient: (patientId: string) => ['lab', 'results', 'patient', patientId] as const,
      byOrder: (orderId: string) => ['lab', 'results', 'order', orderId] as const,
      critical: (workplaceId?: string) => ['lab', 'results', 'critical', workplaceId] as const,
      abnormal: (patientId: string, days?: number) => ['lab', 'results', 'abnormal', patientId, days] as const,
    },
    trends: (patientId: string, testCode: string, days?: number) =>
      ['lab', 'trends', patientId, testCode, days] as const,
    catalog: {
      all: ['lab', 'catalog'] as const,
      search: (search?: string) => ['lab', 'catalog', 'search', search] as const,
    },
    referenceRanges: (testCode: string) => ['lab', 'reference-ranges', testCode] as const,
  },

  // Interactions queries
  interactions: {
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
  },

  // Dashboard and analytics queries
  dashboard: {
    overview: (workspaceId: string) => ['dashboard', 'overview', workspaceId] as const,
    stats: (workspaceId: string, dateRange?: { start: string; end: string }) =>
      ['dashboard', 'stats', workspaceId, dateRange] as const,
    recentActivity: (workspaceId: string, limit?: number) =>
      ['dashboard', 'recent-activity', workspaceId, limit] as const,
  },

  // User and workspace queries
  user: {
    profile: () => ['user', 'profile'] as const,
    preferences: () => ['user', 'preferences'] as const,
    notifications: (unreadOnly?: boolean) => ['user', 'notifications', unreadOnly] as const,
  },

  workspace: {
    current: () => ['workspace', 'current'] as const,
    settings: () => ['workspace', 'settings'] as const,
    members: () => ['workspace', 'members'] as const,
  },
};

// ===============================
// PREFETCHING UTILITIES
// ===============================

export class QueryPrefetcher {
  constructor(private queryClient: QueryClient) { }

  /**
   * Prefetch critical dashboard data
   */
  async prefetchDashboardData(workspaceId: string): Promise<void> {
    const prefetchPromises = [
      // Dashboard overview - high priority
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.overview(workspaceId),
        queryFn: () => this.fetchDashboardOverview(workspaceId),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),

      // User profile - medium priority
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.user.profile(),
        queryFn: () => this.fetchUserProfile(),
        staleTime: 10 * 60 * 1000, // 10 minutes
      }),

      // Recent activity - low priority
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.recentActivity(workspaceId, 10),
        queryFn: () => this.fetchRecentActivity(workspaceId, 10),
        staleTime: 1 * 60 * 1000, // 1 minute
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }

  /**
   * Prefetch patient-related data when viewing patient details
   */
  async prefetchPatientData(patientId: string): Promise<void> {
    const prefetchPromises = [
      // Patient medications
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.medications.byPatient(patientId),
        queryFn: () => this.fetchPatientMedications(patientId),
        staleTime: 5 * 60 * 1000,
      }),

      // Patient allergies
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.allergies.byPatient(patientId),
        queryFn: () => this.fetchPatientAllergies(patientId),
        staleTime: 30 * 60 * 1000, // 30 minutes - allergies change less frequently
      }),

      // Patient conditions
      this.queryClient.prefetchQuery({
        queryKey: queryKeys.conditions.byPatient(patientId),
        queryFn: () => this.fetchPatientConditions(patientId),
        staleTime: 15 * 60 * 1000, // 15 minutes
      }),
    ];

    await Promise.allSettled(prefetchPromises);
  }

  /**
   * Prefetch likely navigation paths
   */
  async prefetchLikelyRoutes(): Promise<void> {
    // Prefetch common navigation destinations based on user role and current page
    const currentPath = window.location.pathname;

    if (currentPath === '/dashboard') {
      // From dashboard, users likely go to patients or medications
      await Promise.allSettled([
        this.queryClient.prefetchQuery({
          queryKey: queryKeys.patients.lists(),
          queryFn: () => this.fetchPatientsList({ limit: 20 }),
          staleTime: 2 * 60 * 1000,
        }),
      ]);
    } else if (currentPath.startsWith('/patients/')) {
      // From patient page, users likely view medications or notes
      const patientId = currentPath.split('/')[2];
      if (patientId) {
        await this.prefetchPatientData(patientId);
      }
    }
  }

  // Mock fetch functions - replace with actual API calls
  private async fetchDashboardOverview(workspaceId: string): Promise<any> {
    const response = await fetch(`/api/dashboard/overview?workspaceId=${workspaceId}`);
    return response.json();
  }

  private async fetchUserProfile(): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/user/settings/profile`, {
      credentials: 'include', // Include httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data; // Extract the user data from the response
  }

  private async fetchRecentActivity(workspaceId: string, limit: number): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/dashboard/recent-activity?workspaceId=${workspaceId}&limit=${limit}`);
    return response.json();
  }

  private async fetchPatientMedications(patientId: string): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/patients/${patientId}/medications`);
    return response.json();
  }

  private async fetchPatientAllergies(patientId: string): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/patients/${patientId}/allergies`);
    return response.json();
  }

  private async fetchPatientConditions(patientId: string): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/patients/${patientId}/conditions`);
    return response.json();
  }

  private async fetchPatientsList(params: { limit: number }): Promise<any> {
    const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
    const response = await fetch(`${base}/api/patients?limit=${params.limit}`);
    return response.json();
  }
}

// ===============================
// QUERY INVALIDATION STRATEGIES
// ===============================

export class QueryInvalidationManager {
  constructor(private queryClient: QueryClient) { }

  /**
   * Invalidate patient-related queries when patient data changes
   */
  async invalidatePatientQueries(patientId: string): Promise<void> {
    const invalidationPromises = [
      // Invalidate patient details
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.patients.detail(patientId),
      }),

      // Invalidate patient medications
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.medications.byPatient(patientId),
      }),

      // Invalidate patient allergies
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.allergies.byPatient(patientId),
      }),

      // Invalidate patient conditions
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.conditions.byPatient(patientId),
      }),

      // Invalidate patient lists (in case patient appears in lists)
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.patients.lists(),
      }),

      // Invalidate dashboard if patient is featured
      this.queryClient.invalidateQueries({
        queryKey: ['dashboard'],
        exact: false,
      }),
    ];

    await Promise.allSettled(invalidationPromises);
  }

  /**
   * Invalidate medication-related queries
   */
  async invalidateMedicationQueries(patientId?: string, medicationId?: string): Promise<void> {
    const invalidationPromises = [
      // Invalidate all medication lists
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.medications.all,
      }),
    ];

    if (patientId) {
      invalidationPromises.push(
        // Invalidate patient-specific medications
        this.queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(patientId),
        }),

        // Invalidate patient summary
        this.queryClient.invalidateQueries({
          queryKey: queryKeys.patients.summary(patientId),
        })
      );
    }

    if (medicationId) {
      invalidationPromises.push(
        // Invalidate specific medication
        this.queryClient.invalidateQueries({
          queryKey: queryKeys.medications.detail(medicationId),
        })
      );
    }

    await Promise.allSettled(invalidationPromises);
  }

  /**
   * Invalidate dashboard queries
   */
  async invalidateDashboardQueries(workspaceId?: string): Promise<void> {
    const invalidationPromises = [
      // Invalidate all dashboard queries
      this.queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      }),
    ];

    if (workspaceId) {
      invalidationPromises.push(
        // Invalidate workspace-specific dashboard
        this.queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.overview(workspaceId),
        }),

        // Invalidate dashboard stats
        this.queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.stats(workspaceId),
        })
      );
    }

    await Promise.allSettled(invalidationPromises);
  }

  /**
   * Smart invalidation based on mutation type
   */
  async smartInvalidation(mutationType: string, entityId?: string, additionalData?: any): Promise<void> {
    switch (mutationType) {
      case 'patient_created':
      case 'patient_updated':
        if (entityId) {
          await this.invalidatePatientQueries(entityId);
        }
        break;

      case 'medication_created':
      case 'medication_updated':
      case 'medication_deleted':
        await this.invalidateMedicationQueries(additionalData?.patientId, entityId);
        break;

      case 'clinical_note_created':
      case 'clinical_note_updated':
        if (additionalData?.patientId) {
          await this.queryClient.invalidateQueries({
            queryKey: queryKeys.clinicalNotes.byPatient(additionalData.patientId),
          });
        }
        break;

      case 'user_profile_updated':
        await this.queryClient.invalidateQueries({
          queryKey: queryKeys.user.profile(),
        });
        break;

      default:
        // Fallback: invalidate dashboard
        await this.invalidateDashboardQueries();
    }
  }
}

// Create instances for use throughout the app
export const queryPrefetcher = new QueryPrefetcher(queryClient);
export const queryInvalidationManager = new QueryInvalidationManager(queryClient);
