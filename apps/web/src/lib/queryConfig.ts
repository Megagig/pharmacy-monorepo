/**
 * Query configuration utilities for different data types and use cases
 */

import { UseQueryOptions } from '@tanstack/react-query';

// ===============================
// QUERY CONFIGURATION PRESETS
// ===============================

export interface QueryConfigOptions {
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  keepPreviousData?: boolean;
  retry?: number | boolean | ((failureCount: number, error: any) => boolean);
  retryDelay?: number | ((attemptIndex: number) => number);
}

/**
 * Configuration presets for different types of data
 */
export const queryConfigs = {
  // Real-time data (notifications, live updates)
  realTime: {
    staleTime: 0, // Always considered stale
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    keepPreviousData: false,
    retry: 3,
  } as QueryConfigOptions,

  // Critical data (dashboard, active interventions)
  critical: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
    retry: 3,
  } as QueryConfigOptions,

  // Frequently changing data (patient lists, medication lists)
  frequent: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 2,
  } as QueryConfigOptions,

  // Standard data (patient details, medication details)
  standard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 2,
  } as QueryConfigOptions,

  // Stable data (user profile, settings, lookup data)
  stable: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 1,
  } as QueryConfigOptions,

  // Static data (reference data, configurations)
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 1,
  } as QueryConfigOptions,

  // Search queries (temporary, user-driven)
  search: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: false,
    retry: 1,
  } as QueryConfigOptions,

  // Background data (analytics, reports)
  background: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 1,
  } as QueryConfigOptions,
};

/**
 * Create query options with preset configuration
 */
export function createQueryConfig<TData = unknown, TError = unknown>(
  preset: keyof typeof queryConfigs,
  overrides?: Partial<UseQueryOptions<TData, TError>>
): UseQueryOptions<TData, TError> {
  const baseConfig = queryConfigs[preset];
  
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Smart retry function based on error type
 */
export const smartRetry = (failureCount: number, error: any): boolean => {
  // Don't retry on authentication errors
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return false;
  }

  // Don't retry on client errors (4xx)
  if (error?.response?.status >= 400 && error?.response?.status < 500) {
    return false;
  }

  // Don't retry when offline
  if (!navigator.onLine) {
    return false;
  }

  // Retry up to 3 times for server errors
  return failureCount < 3;
};

/**
 * Exponential backoff with jitter
 */
export const exponentialBackoff = (attemptIndex: number): number => {
  const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
  const jitter = Math.random() * 0.1 * baseDelay;
  return baseDelay + jitter;
};

// ===============================
// SPECIALIZED CONFIGURATIONS
// ===============================

/**
 * Configuration for infinite queries (pagination)
 */
export const infiniteQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000, // 15 minutes
  keepPreviousData: true,
  retry: smartRetry,
  retryDelay: exponentialBackoff,
  refetchOnWindowFocus: false,
};

/**
 * Configuration for mutation queries
 */
export const mutationConfig = {
  retry: 1,
  retryDelay: 1000,
};

/**
 * Configuration based on network conditions
 */
export function getNetworkAwareConfig(): QueryConfigOptions {
  // Check connection type if available
  const connection = (navigator as any).connection;
  
  if (connection) {
    // Slow connection - reduce frequency and increase cache times
    if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
      return {
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        refetchInterval: false,
        refetchOnWindowFocus: false,
        keepPreviousData: true,
        retry: 1,
      };
    }
    
    // Fast connection - more aggressive caching
    if (connection.effectiveType === '4g') {
      return {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchInterval: false,
        refetchOnWindowFocus: true,
        keepPreviousData: true,
        retry: 3,
      };
    }
  }

  // Default configuration
  return queryConfigs.standard;
}

/**
 * Configuration based on device capabilities
 */
export function getDeviceAwareConfig(): QueryConfigOptions {
  // Check if device has limited memory
  const memory = (navigator as any).deviceMemory;
  
  if (memory && memory < 4) {
    // Limited memory - reduce cache times
    return {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: false,
      refetchOnWindowFocus: false,
      keepPreviousData: false, // Don't keep previous data to save memory
      retry: 1,
    };
  }

  // High-end device - more aggressive caching
  return {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchInterval: false,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
    retry: 3,
  };
}

// ===============================
// QUERY KEY UTILITIES
// ===============================

/**
 * Utility to create consistent query keys
 */
export class QueryKeyBuilder {
  private parts: (string | number | object)[] = [];

  static create(): QueryKeyBuilder {
    return new QueryKeyBuilder();
  }

  entity(name: string): QueryKeyBuilder {
    this.parts.push(name);
    return this;
  }

  operation(op: string): QueryKeyBuilder {
    this.parts.push(op);
    return this;
  }

  id(id: string | number): QueryKeyBuilder {
    this.parts.push(id);
    return this;
  }

  params(params: object): QueryKeyBuilder {
    if (Object.keys(params).length > 0) {
      this.parts.push(params);
    }
    return this;
  }

  build(): (string | number | object)[] {
    return [...this.parts];
  }
}

// ===============================
// CACHE MANAGEMENT UTILITIES
// ===============================

/**
 * Utility for managing query cache lifecycle
 */
export class CacheLifecycleManager {
  /**
   * Get cache configuration based on data importance
   */
  static getConfigByImportance(importance: 'critical' | 'high' | 'medium' | 'low'): QueryConfigOptions {
    switch (importance) {
      case 'critical':
        return queryConfigs.critical;
      case 'high':
        return queryConfigs.frequent;
      case 'medium':
        return queryConfigs.standard;
      case 'low':
        return queryConfigs.background;
      default:
        return queryConfigs.standard;
    }
  }

  /**
   * Get cache configuration based on update frequency
   */
  static getConfigByUpdateFrequency(frequency: 'realtime' | 'frequent' | 'occasional' | 'rare'): QueryConfigOptions {
    switch (frequency) {
      case 'realtime':
        return queryConfigs.realTime;
      case 'frequent':
        return queryConfigs.frequent;
      case 'occasional':
        return queryConfigs.standard;
      case 'rare':
        return queryConfigs.stable;
      default:
        return queryConfigs.standard;
    }
  }

  /**
   * Get cache configuration based on user interaction pattern
   */
  static getConfigByUsagePattern(pattern: 'interactive' | 'background' | 'search' | 'reference'): QueryConfigOptions {
    switch (pattern) {
      case 'interactive':
        return queryConfigs.critical;
      case 'background':
        return queryConfigs.background;
      case 'search':
        return queryConfigs.search;
      case 'reference':
        return queryConfigs.static;
      default:
        return queryConfigs.standard;
    }
  }
}

// ===============================
// PERFORMANCE MONITORING
// ===============================

/**
 * Query performance monitoring utilities
 */
export class QueryPerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static recordMetric(queryKey: string, duration: number): void {
    if (!this.metrics.has(queryKey)) {
      this.metrics.set(queryKey, []);
    }
    
    const times = this.metrics.get(queryKey)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  static recordQueryTime(queryKey: string, duration: number): void {
    if (!this.metrics.has(queryKey)) {
      this.metrics.set(queryKey, []);
    }
    
    const times = this.metrics.get(queryKey)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  static getQueryStats(queryKey: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const times = this.metrics.get(queryKey);
    if (!times || times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(count * 0.95);

    return {
      count,
      average: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[p95Index],
    };
  }

  static getAllStats(): Record<string, ReturnType<typeof QueryPerformanceMonitor.getQueryStats>> {
    const stats: Record<string, any> = {};
    
    for (const [queryKey] of this.metrics) {
      stats[queryKey] = this.getQueryStats(queryKey);
    }
    
    return stats;
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }
}