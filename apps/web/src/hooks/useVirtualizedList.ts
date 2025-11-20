import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

interface VirtualizedListOptions<T> {
  queryKey: string[];
  queryFn: (params: { pageParam?: string | number }) => Promise<{
    data: T[];
    nextCursor?: string | number;
    hasNextPage?: boolean;
    total?: number;
  }>;
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number; // Renamed from cacheTime in newer TanStack Query versions
  keepPreviousData?: boolean;
  refetchOnWindowFocus?: boolean;
}

interface VirtualizedListResult<T> {
  // Data
  items: T[];
  totalCount: number;

  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;

  // Pagination
  hasNextPage: boolean;
  isLoadingNextPage: boolean;
  loadNextPage: () => Promise<void>;

  // Utilities
  refresh: () => void;
  invalidate: () => void;

  // Performance metrics
  metrics: {
    totalItems: number;
    loadedPages: number;
    averagePageSize: number;
    cacheHitRatio: number;
  };
}

export const useVirtualizedList = <T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  keepPreviousData = true,
  refetchOnWindowFocus = false,
}: VirtualizedListOptions<T>): VirtualizedListResult<T> => {
  const [cacheHits, setCacheHits] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const loadStartTime = useRef<number>(Date.now());
  const queryClient = useQueryClient();

  // Use React Query's infinite query
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: string | number }) => {
      const startTime = Date.now();
      setTotalRequests(prev => prev + 1);

      try {
        const result = await queryFn({ pageParam });

        // Track cache performance (simplified - in real app you'd check if data came from cache)
        const responseTime = Date.now() - startTime;
        if (responseTime < 50) { // Assume fast responses are cache hits
          setCacheHits(prev => prev + 1);
        }

        return result;
      } catch (err) {
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      return lastPage?.hasNextPage ? lastPage?.nextCursor : undefined;
    },
    enabled,
    staleTime,
    gcTime,
    placeholderData: keepPreviousData ? (previousData: any) => previousData : undefined,
    refetchOnWindowFocus,
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Flatten all pages into a single array
  const items = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: any) => page?.data || []);
  }, [data?.pages]);

  // Calculate total count from the first page response
  const totalCount = useMemo(() => {
    return (data?.pages?.[0] as any)?.total ?? items.length;
  }, [data?.pages, items.length]);

  // Load next page with error handling
  const loadNextPage = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage();
      } catch (error) {
        console.error('Failed to load next page:', error);
        throw error;
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Refresh data
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Invalidate and remove from cache
  const invalidate = useCallback(() => {
    queryClient.removeQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Performance metrics
  const metrics = useMemo(() => {
    const loadedPages = data?.pages?.length ?? 0;
    const totalItems = items.length;
    const averagePageSize = loadedPages > 0 ? totalItems / loadedPages : 0;
    const cacheHitRatio = totalRequests > 0 ? cacheHits / totalRequests : 0;

    return {
      totalItems,
      loadedPages,
      averagePageSize,
      cacheHitRatio,
    };
  }, [items.length, data?.pages?.length, cacheHits, totalRequests]);

  // Performance monitoring
  useEffect(() => {
    if (items.length > 0 && loadStartTime.current) {
      const loadTime = Date.now() - loadStartTime.current;

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
      }
    }
  }, [items.length, metrics]);

  return {
    // Data
    items,
    totalCount,

    // Loading states
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,

    // Pagination
    hasNextPage: !!hasNextPage,
    isLoadingNextPage: isFetchingNextPage,
    loadNextPage,

    // Utilities
    refresh,
    invalidate,

    // Performance metrics
    metrics,
  };
};

// Hook for virtualized patient list specifically
export const useVirtualizedPatients = (searchParams: any = {}) => {
  return useVirtualizedList({
    queryKey: ['patients', 'virtualized', searchParams],
    queryFn: async ({ pageParam = 1 }) => {
      // Import the API client
      const { default: api } = await import('../services/api');

      // Build query parameters
      const params: any = {
        page: pageParam,
        limit: 50,
        useCursor: false, // Use legacy pagination for now
        ...searchParams
      };

      // Remove undefined/null/empty values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

      const response = await api.get('/patients', { params });
      const result = response.data;

      // Handle the backend response structure
      return {
        data: result.data || [],
        nextCursor: result.pagination?.hasNextPage ? (pageParam as number) + 1 : undefined,
        hasNextPage: result.pagination?.hasNextPage || false,
        total: result.pagination?.total || result.total || 0,
      };
    },
    pageSize: 50,
    staleTime: 2 * 60 * 1000, // 2 minutes for patient data
  });
};

// Hook for virtualized clinical notes
export const useVirtualizedClinicalNotes = (patientId: string) => {
  return useVirtualizedList({
    queryKey: ['clinical-notes', 'virtualized', patientId],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/patients/${patientId}/clinical-notes?page=${pageParam}&limit=30`);

      if (!response.ok) {
        throw new Error('Failed to fetch clinical notes');
      }

      const result = await response.json();

      return {
        data: result.data?.results || [],
        nextCursor: result.data?.hasNextPage ? (pageParam as number) + 1 : undefined,
        hasNextPage: result.data?.hasNextPage || false,
        total: result.meta?.total || 0,
      };
    },
    pageSize: 30,
    enabled: !!patientId,
  });
};

// Hook for virtualized medications
export const useVirtualizedMedications = (patientId: string) => {
  return useVirtualizedList({
    queryKey: ['medications', 'virtualized', patientId],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/patients/${patientId}/medications?page=${pageParam}&limit=40`);

      if (!response.ok) {
        throw new Error('Failed to fetch medications');
      }

      const result = await response.json();

      return {
        data: result.data?.results || [],
        nextCursor: result.data?.hasNextPage ? (pageParam as number) + 1 : undefined,
        hasNextPage: result.data?.hasNextPage || false,
        total: result.meta?.total || 0,
      };
    },
    pageSize: 40,
    enabled: !!patientId,
  });
};

export default useVirtualizedList;
