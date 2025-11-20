// TanStack Query Hooks - Main exports
export * from './usePatients';
export * from './useMedications';
export * from './useClinicalNotes';
export * from './useMTRQueries';
export * from './useClinicalInterventions';
export * from './useWorkspaceTeam';

// Diagnostics module hooks
export * from '../modules/diagnostics/hooks/useDiagnostics';
export * from '../modules/diagnostics/hooks/useLabOrders';
export * from '../modules/diagnostics/hooks/useLabResults';
export * from '../modules/diagnostics/hooks/useLabTrends';
export * from '../modules/diagnostics/hooks/useInteractions';

// Query client and keys
export { queryClient, queryKeys } from '../lib/queryClient';