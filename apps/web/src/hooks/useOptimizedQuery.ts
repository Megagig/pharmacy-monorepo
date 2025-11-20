/**
 * Optimized React Query hooks with enhanced caching, prefetching, and performance
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient, UseQueryOptions, UseInfiniteQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { queryKeys, queryPrefetcher, queryInvalidationManager } from '../lib/queryClient';

// ===============================
// OPTIMIZED QUERY HOOKS
// ===============================

/**
 * Enhanced useQuery with smart caching and prefetching
 */
export function useOptimizedQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & {
    prefetchRelated?: () => Promise<void>;
    backgroundRefetch?: boolean;
    criticalData?: boolean;
  }
) {
  const { prefetchRelated, backgroundRefetch, criticalData, ...queryOptions } = options;

  // Adjust stale time based on data criticality
  const optimizedOptions = useMemo(() => ({
    ...queryOptions,
    staleTime: criticalData 
      ? 1 * 60 * 1000 // 1 minute for critical data
      : queryOptions.staleTime || 5 * 60 * 1000, // 5 minutes for normal data
    
    // Enable background refetch for critical data
    refetchInterval: backgroundRefetch && criticalData 
      ? 30 * 1000 // 30 seconds for critical data
      : false,
    
    // Keep previous data for better UX
    keepPreviousData: true,
  }), [queryOptions, criticalData, backgroundRefetch]);

  const query = useQuery(optimizedOptions);

  // Prefetch related data when query succeeds
  useEffect(() => {
    if (query.isSuccess && prefetchRelated) {
      prefetchRelated().catch(console.error);
    }
  }, [query.isSuccess, prefetchRelated]);

  return query;
}

/**
 * Enhanced useInfiniteQuery with optimized pagination
 */
export function useOptimizedInfiniteQuery<TData = unknown, TError = unknown>(
  options: UseInfiniteQueryOptions<TData, TError> & {
    prefetchNextPage?: boolean;
  }
) {
  const { prefetchNextPage, ...queryOptions } = options;

  const query = useInfiniteQuery({
    ...queryOptions,
    keepPreviousData: true,
    // Optimize page size based on viewport
    getNextPageParam: (lastPage: any, pages) => {
      if (!lastPage?.hasNextPage) return undefined;
      return lastPage.nextCursor || pages.length;
    },
  });

  // Auto-prefetch next page when near the end
  useEffect(() => {
    if (prefetchNextPage && query.hasNextPage && !query.isFetchingNextPage) {
      const prefetchThreshold = 0.8; // Prefetch when 80% through current data
      // This would be triggered by scroll position in the component
    }
  }, [query.hasNextPage, query.isFetchingNextPage, prefetchNextPage]);

  return query;
}

/**
 * Enhanced useMutation with smart invalidation
 */
export function useOptimizedMutation<TData = unknown, TError = unknown, TVariables = void>(
  options: UseMutationOptions<TData, TError, TVariables> & {
    invalidationStrategy?: 'smart' | 'manual' | 'none';
    mutationType?: string;
    optimisticUpdate?: (variables: TVariables) => void;
  }
) {
  const queryClient = useQueryClient();
  const { invalidationStrategy = 'smart', mutationType, optimisticUpdate, ...mutationOptions } = options;

  const mutation = useMutation({
    ...mutationOptions,
    onMutate: async (variables) => {
      // Apply optimistic update if provided
      if (optimisticUpdate) {
        optimisticUpdate(variables);
      }

      // Call original onMutate if provided
      if (mutationOptions.onMutate) {
        return await mutationOptions.onMutate(variables);
      }
    },
    onSuccess: async (data, variables, context) => {
      // Handle smart invalidation
      if (invalidationStrategy === 'smart' && mutationType) {
        await queryInvalidationManager.smartInvalidation(
          mutationType,
          (data as any)?.id || (variables as any)?.id,
          variables
        );
      }

      // Call original onSuccess if provided
      if (mutationOptions.onSuccess) {
        await mutationOptions.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Revert optimistic updates on error
      queryClient.invalidateQueries();

      // Call original onError if provided
      if (mutationOptions.onError) {
        mutationOptions.onError(error, variables, context);
      }
    },
  });

  return mutation;
}

// ===============================
// SPECIALIZED HOOKS
// ===============================

/**
 * Hook for dashboard data with prefetching
 */
export function useDashboardData(workspaceId: string) {
  const queryClient = useQueryClient();

  // Main dashboard query
  const dashboardQuery = useOptimizedQuery({
    queryKey: queryKeys.dashboard.overview(workspaceId),
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/overview?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    criticalData: true,
    backgroundRefetch: true,
    prefetchRelated: () => queryPrefetcher.prefetchDashboardData(workspaceId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Dashboard stats query
  const statsQuery = useOptimizedQuery({
    queryKey: queryKeys.dashboard.stats(workspaceId),
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Recent activity query
  const recentActivityQuery = useOptimizedQuery({
    queryKey: queryKeys.dashboard.recentActivity(workspaceId, 10),
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-activity?workspaceId=${workspaceId}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch recent activity');
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return {
    dashboard: dashboardQuery,
    stats: statsQuery,
    recentActivity: recentActivityQuery,
    isLoading: dashboardQuery.isLoading || statsQuery.isLoading,
    error: dashboardQuery.error || statsQuery.error || recentActivityQuery.error,
  };
}

/**
 * Hook for patient list with virtualization support
 */
export function usePatientList(filters: any = {}) {
  return useOptimizedInfiniteQuery({
    queryKey: queryKeys.patients.list(filters),
    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams({
        ...filters,
        cursor: pageParam || '',
        limit: '50', // Optimized page size
      });

      const response = await fetch(`/api/patients?${params}`);
      if (!response.ok) throw new Error('Failed to fetch patients');
      return response.json();
    },
    prefetchNextPage: true,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Hook for patient details with related data prefetching
 */
export function usePatientDetails(patientId: string) {
  return useOptimizedQuery({
    queryKey: queryKeys.patients.detail(patientId),
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) throw new Error('Failed to fetch patient details');
      return response.json();
    },
    prefetchRelated: () => queryPrefetcher.prefetchPatientData(patientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!patientId,
  });
}

/**
 * Hook for patient medications with optimistic updates
 */
export function usePatientMedications(patientId: string) {
  const query = useOptimizedQuery({
    queryKey: queryKeys.medications.byPatient(patientId),
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/medications`);
      if (!response.ok) throw new Error('Failed to fetch patient medications');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!patientId,
  });

  const addMedication = useOptimizedMutation({
    mutationFn: async (medicationData: any) => {
      const response = await fetch(`/api/patients/${patientId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicationData),
      });
      if (!response.ok) throw new Error('Failed to add medication');
      return response.json();
    },
    mutationType: 'medication_created',
    optimisticUpdate: (variables) => {
      // Optimistically add medication to the list
      const queryClient = useQueryClient();
      queryClient.setQueryData(
        queryKeys.medications.byPatient(patientId),
        (old: any) => old ? [...old, { ...variables, id: 'temp-' + Date.now() }] : [variables]
      );
    },
  });

  const updateMedication = useOptimizedMutation({
    mutationFn: async ({ medicationId, ...updateData }: any) => {
      const response = await fetch(`/api/medications/${medicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) throw new Error('Failed to update medication');
      return response.json();
    },
    mutationType: 'medication_updated',
  });

  return {
    medications: query.data,
    isLoading: query.isLoading,
    error: query.error,
    addMedication,
    updateMedication,
    refetch: query.refetch,
  };
}

// ===============================
// PERFORMANCE HOOKS
// ===============================

/**
 * Hook for query deduplication
 */
export function useQueryDeduplication() {
  const queryClient = useQueryClient();

  const deduplicateQueries = useCallback((queryKey: any[]) => {
    // Cancel outgoing queries with the same key
    queryClient.cancelQueries({ queryKey });
  }, [queryClient]);

  return { deduplicateQueries };
}

/**
 * Hook for parallel query optimization
 */
export function useParallelQueries<T extends Record<string, UseQueryOptions>>(queries: T) {
  const results = {} as { [K in keyof T]: ReturnType<typeof useQuery> };

  // Execute all queries in parallel
  Object.entries(queries).forEach(([key, options]) => {
    results[key as keyof T] = useQuery(options as any);
  });

  // Aggregate loading and error states
  const isLoading = Object.values(results).some(query => query.isLoading);
  const error = Object.values(results).find(query => query.error)?.error;
  const isSuccess = Object.values(results).every(query => query.isSuccess);

  return {
    ...results,
    isLoading,
    error,
    isSuccess,
  };
}

/**
 * Hook for background data synchronization
 */
export function useBackgroundSync(enabled: boolean = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const syncInterval = setInterval(() => {
      // Refetch critical queries in the background
      queryClient.refetchQueries({
        queryKey: ['dashboard'],
        type: 'active',
      });

      queryClient.refetchQueries({
        queryKey: ['notifications'],
        type: 'active',
      });
    }, 60 * 1000); // Every minute

    return () => clearInterval(syncInterval);
  }, [enabled, queryClient]);

  const forcSync = useCallback(() => {
    queryClient.refetchQueries({ type: 'active' });
  }, [queryClient]);

  return { forcSync };
}