/**
 * TanStack Query Configuration
 * Default configuration for React Query
 */
import { QueryClient } from '@tanstack/react-query';
/**
 * Default query options
 */
const queryConfig = {
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
export function createQueryClient() {
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
        user: ['auth', 'user'],
        permissions: ['auth', 'permissions'],
    },
    // Patients
    patients: {
        all: ['patients'],
        lists: () => [...queryKeys.patients.all, 'list'],
        list: (filters) => [...queryKeys.patients.lists(), filters],
        details: () => [...queryKeys.patients.all, 'detail'],
        detail: (id) => [...queryKeys.patients.details(), id],
        allergies: (patientId) => [...queryKeys.patients.detail(patientId), 'allergies'],
        conditions: (patientId) => [...queryKeys.patients.detail(patientId), 'conditions'],
        medications: (patientId) => [...queryKeys.patients.detail(patientId), 'medications'],
        visits: (patientId) => [...queryKeys.patients.detail(patientId), 'visits'],
    },
    // Workspace
    workspace: {
        all: ['workspace'],
        members: () => [...queryKeys.workspace.all, 'members'],
        invites: () => [...queryKeys.workspace.all, 'invites'],
        auditLogs: () => [...queryKeys.workspace.all, 'audit-logs'],
        stats: () => [...queryKeys.workspace.all, 'stats'],
    },
    // RBAC
    rbac: {
        all: ['rbac'],
        roles: () => [...queryKeys.rbac.all, 'roles'],
        permissions: () => [...queryKeys.rbac.all, 'permissions'],
        userRoles: (userId) => [...queryKeys.rbac.all, 'user-roles', userId],
    },
    // Prescriptions
    prescriptions: {
        all: ['prescriptions'],
        lists: () => [...queryKeys.prescriptions.all, 'list'],
        list: (filters) => [...queryKeys.prescriptions.lists(), filters],
        details: () => [...queryKeys.prescriptions.all, 'detail'],
        detail: (id) => [...queryKeys.prescriptions.details(), id],
    },
    // Appointments
    appointments: {
        all: ['appointments'],
        lists: () => [...queryKeys.appointments.all, 'list'],
        list: (filters) => [...queryKeys.appointments.lists(), filters],
        details: () => [...queryKeys.appointments.all, 'detail'],
        detail: (id) => [...queryKeys.appointments.details(), id],
        types: () => [...queryKeys.appointments.all, 'types'],
    },
};
//# sourceMappingURL=query.js.map