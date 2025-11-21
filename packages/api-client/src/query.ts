/**
 * TanStack Query Configuration
 * Default configuration for React Query
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';

/**
 * Default query options
 */
const queryConfig: DefaultOptions = {
    queries: {
        // Stale time: 5 minutes
        staleTime: 5 * 60 * 1000,

        // Cache time: 10 minutes
        gcTime: 10 * 60 * 1000,

        // Retry failed requests 3 times
        retry: 3,

        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch on window focus (useful for web)
        refetchOnWindowFocus: true,

        // Refetch on reconnect
        refetchOnReconnect: true,

        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
    },
    mutations: {
        // Retry mutations once
        retry: 1,
    },
};

/**
 * Create query client with default configuration
 */
export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: queryConfig,
    });
}

/**
 * Default query client instance
 */
export const queryClient = createQueryClient();

/**
 * Query keys factory for consistent cache keys
 */
export const queryKeys = {
    // Auth
    auth: {
        user: ['auth', 'user'] as const,
        permissions: ['auth', 'permissions'] as const,
    },

    // Patients
    patients: {
        all: ['patients'] as const,
        lists: () => [...queryKeys.patients.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...queryKeys.patients.lists(), filters] as const,
        details: () => [...queryKeys.patients.all, 'detail'] as const,
        detail: (id: string) => [...queryKeys.patients.details(), id] as const,
        allergies: (patientId: string) =>
            [...queryKeys.patients.detail(patientId), 'allergies'] as const,
        conditions: (patientId: string) =>
            [...queryKeys.patients.detail(patientId), 'conditions'] as const,
        medications: (patientId: string) =>
            [...queryKeys.patients.detail(patientId), 'medications'] as const,
        visits: (patientId: string) =>
            [...queryKeys.patients.detail(patientId), 'visits'] as const,
    },

    // Workspace
    workspace: {
        all: ['workspace'] as const,
        members: () => [...queryKeys.workspace.all, 'members'] as const,
        invites: () => [...queryKeys.workspace.all, 'invites'] as const,
        auditLogs: () => [...queryKeys.workspace.all, 'audit-logs'] as const,
        stats: () => [...queryKeys.workspace.all, 'stats'] as const,
    },

    // RBAC
    rbac: {
        all: ['rbac'] as const,
        roles: () => [...queryKeys.rbac.all, 'roles'] as const,
        permissions: () => [...queryKeys.rbac.all, 'permissions'] as const,
        userRoles: (userId: string) =>
            [...queryKeys.rbac.all, 'user-roles', userId] as const,
    },

    // Prescriptions
    prescriptions: {
        all: ['prescriptions'] as const,
        lists: () => [...queryKeys.prescriptions.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...queryKeys.prescriptions.lists(), filters] as const,
        details: () => [...queryKeys.prescriptions.all, 'detail'] as const,
        detail: (id: string) => [...queryKeys.prescriptions.details(), id] as const,
    },

    // Appointments
    appointments: {
        all: ['appointments'] as const,
        lists: () => [...queryKeys.appointments.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...queryKeys.appointments.lists(), filters] as const,
        details: () => [...queryKeys.appointments.all, 'detail'] as const,
        detail: (id: string) => [...queryKeys.appointments.details(), id] as const,
        types: () => [...queryKeys.appointments.all, 'types'] as const,
    },
} as const;
