/**
 * TanStack Query Configuration
 * Default configuration for React Query
 */
import { QueryClient } from '@tanstack/react-query';
/**
 * Create query client with default configuration
 */
export declare function createQueryClient(): QueryClient;
/**
 * Default query client instance
 */
export declare const queryClient: QueryClient;
/**
 * Query keys factory for consistent cache keys
 */
export declare const queryKeys: {
    readonly auth: {
        readonly user: readonly ["auth", "user"];
        readonly permissions: readonly ["auth", "permissions"];
    };
    readonly patients: {
        readonly all: readonly ["patients"];
        readonly lists: () => readonly ["patients", "list"];
        readonly list: (filters: Record<string, unknown>) => readonly ["patients", "list", Record<string, unknown>];
        readonly details: () => readonly ["patients", "detail"];
        readonly detail: (id: string) => readonly ["patients", "detail", string];
        readonly allergies: (patientId: string) => readonly ["patients", "detail", string, "allergies"];
        readonly conditions: (patientId: string) => readonly ["patients", "detail", string, "conditions"];
        readonly medications: (patientId: string) => readonly ["patients", "detail", string, "medications"];
        readonly visits: (patientId: string) => readonly ["patients", "detail", string, "visits"];
    };
    readonly workspace: {
        readonly all: readonly ["workspace"];
        readonly members: () => readonly ["workspace", "members"];
        readonly invites: () => readonly ["workspace", "invites"];
        readonly auditLogs: () => readonly ["workspace", "audit-logs"];
        readonly stats: () => readonly ["workspace", "stats"];
    };
    readonly rbac: {
        readonly all: readonly ["rbac"];
        readonly roles: () => readonly ["rbac", "roles"];
        readonly permissions: () => readonly ["rbac", "permissions"];
        readonly userRoles: (userId: string) => readonly ["rbac", "user-roles", string];
    };
    readonly prescriptions: {
        readonly all: readonly ["prescriptions"];
        readonly lists: () => readonly ["prescriptions", "list"];
        readonly list: (filters: Record<string, unknown>) => readonly ["prescriptions", "list", Record<string, unknown>];
        readonly details: () => readonly ["prescriptions", "detail"];
        readonly detail: (id: string) => readonly ["prescriptions", "detail", string];
    };
    readonly appointments: {
        readonly all: readonly ["appointments"];
        readonly lists: () => readonly ["appointments", "list"];
        readonly list: (filters: Record<string, unknown>) => readonly ["appointments", "list", Record<string, unknown>];
        readonly details: () => readonly ["appointments", "detail"];
        readonly detail: (id: string) => readonly ["appointments", "detail", string];
        readonly types: () => readonly ["appointments", "types"];
    };
};
//# sourceMappingURL=query.d.ts.map