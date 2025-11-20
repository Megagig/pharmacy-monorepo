/**
 * Tests for React Query optimization implementation
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { queryClient, queryKeys, queryPrefetcher, queryInvalidationManager } from '../lib/queryClient';
import { useOptimizedQuery, useOptimizedMutation, useDashboardData } from '../hooks/useOptimizedQuery';
import { useRoutePrefetching } from '../hooks/useRoutePrefetching';
import { QueryPerformanceMonitor } from '../lib/queryConfig';

// Mock fetch
global.fetch = vi.fn();

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={testQueryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('React Query Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    QueryPerformanceMonitor.clearMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query Configuration', () => {
    it('should have optimized default configuration', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      
      expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000); // 5 minutes
      expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000); // 10 minutes
      expect(defaultOptions.queries?.keepPreviousData).toBe(true);
      expect(defaultOptions.queries?.networkMode).toBe('offlineFirst');
    });

    it('should have smart retry strategy', () => {
      const retryFn = queryClient.getDefaultOptions().queries?.retry as Function;
      
      // Should not retry on 4xx errors
      expect(retryFn(1, { response: { status: 404 } })).toBe(false);
      expect(retryFn(1, { response: { status: 401 } })).toBe(false);
      
      // Should retry on 5xx errors
      expect(retryFn(1, { response: { status: 500 } })).toBe(true);
      expect(retryFn(2, { response: { status: 500 } })).toBe(true);
      expect(retryFn(3, { response: { status: 500 } })).toBe(false); // Max retries reached
    });

    it('should have exponential backoff with jitter', () => {
      const retryDelayFn = queryClient.getDefaultOptions().queries?.retryDelay as Function;
      
      const delay1 = retryDelayFn(0);
      const delay2 = retryDelayFn(1);
      const delay3 = retryDelayFn(2);
      
      expect(delay1).toBeGreaterThan(1000);
      expect(delay1).toBeLessThan(1200); // Base + jitter
      expect(delay2).toBeGreaterThan(2000);
      expect(delay2).toBeLessThan(2400);
      expect(delay3).toBeGreaterThan(4000);
      expect(delay3).toBeLessThan(4800);
    });
  });

  describe('Query Keys', () => {
    it('should generate consistent query keys', () => {
      const patientId = 'patient-123';
      const workspaceId = 'workspace-456';
      
      expect(queryKeys.patients.detail(patientId)).toEqual(['patients', 'detail', patientId]);
      expect(queryKeys.medications.byPatient(patientId)).toEqual(['medications', 'patient', patientId]);
      expect(queryKeys.dashboard.overview(workspaceId)).toEqual(['dashboard', 'overview', workspaceId]);
    });

    it('should handle filters in query keys', () => {
      const filters = { status: 'active', category: 'medication' };
      
      expect(queryKeys.patients.list(filters)).toEqual(['patients', 'list', { filters }]);
    });
  });

  describe('Optimized Query Hook', () => {
    const TestComponent: React.FC<{ criticalData?: boolean }> = ({ criticalData }) => {
      const { data, isLoading, error } = useOptimizedQuery({
        queryKey: ['test-query'],
        queryFn: async () => {
          const response = await fetch('/api/test');
          if (!response.ok) throw new Error('Test error');
          return response.json();
        },
        criticalData,
      });

      if (isLoading) return <div>Loading...</div>;
      if (error) return <div>Error: {(error as Error).message}</div>;
      return <div>Data: {JSON.stringify(data)}</div>;
    };

    it('should use optimized configuration for critical data', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'data' }),
      });

      render(
        <TestWrapper>
          <TestComponent criticalData={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Data: {"test":"data"}')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/test');
    });

    it('should handle errors gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Data Hook', () => {
    const TestDashboard: React.FC = () => {
      const { dashboard, stats, isLoading, error } = useDashboardData('workspace-123');

      if (isLoading) return <div>Loading dashboard...</div>;
      if (error) return <div>Dashboard error</div>;
      
      return (
        <div>
          <div>Dashboard loaded</div>
          {dashboard.data && <div>Dashboard data: {dashboard.data.title}</div>}
          {stats.data && <div>Stats: {stats.data.count}</div>}
        </div>
      );
    };

    it('should load dashboard data with prefetching', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ title: 'Test Dashboard' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ count: 42 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ activities: [] }),
        });

      render(
        <TestWrapper>
          <TestDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard loaded')).toBeInTheDocument();
      });

      // Should have called multiple endpoints
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/overview?workspaceId=workspace-123');
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/stats?workspaceId=workspace-123');
    });
  });

  describe('Optimized Mutation Hook', () => {
    const TestMutation: React.FC = () => {
      const mutation = useOptimizedMutation({
        mutationFn: async (data: any) => {
          const response = await fetch('/api/test', {
            method: 'POST',
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Mutation failed');
          return response.json();
        },
        mutationType: 'patient_created',
        invalidationStrategy: 'smart',
      });

      return (
        <div>
          <button
            onClick={() => mutation.mutate({ name: 'Test Patient' })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create Patient'}
          </button>
          {mutation.isSuccess && <div>Patient created</div>}
          {mutation.error && <div>Error: {(mutation.error as Error).message}</div>}
        </div>
      );
    };

    it('should handle mutations with smart invalidation', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'patient-123', name: 'Test Patient' }),
      });

      render(
        <TestWrapper>
          <TestMutation />
        </TestWrapper>
      );

      const button = screen.getByText('Create Patient');
      
      act(() => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByText('Patient created')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Patient' }),
      });
    });
  });

  describe('Query Prefetcher', () => {
    it('should prefetch dashboard data', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ title: 'Dashboard' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: 'User' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ activities: [] }),
        });

      await queryPrefetcher.prefetchDashboardData('workspace-123');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/overview?workspaceId=workspace-123');
      expect(fetch).toHaveBeenCalledWith('/api/user/profile');
      expect(fetch).toHaveBeenCalledWith('/api/dashboard/recent-activity?workspaceId=workspace-123&limit=10');
    });

    it('should prefetch patient data', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ medications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ allergies: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conditions: [] }),
        });

      await queryPrefetcher.prefetchPatientData('patient-123');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith('/api/patients/patient-123/medications');
      expect(fetch).toHaveBeenCalledWith('/api/patients/patient-123/allergies');
      expect(fetch).toHaveBeenCalledWith('/api/patients/patient-123/conditions');
    });
  });

  describe('Query Invalidation Manager', () => {
    it('should invalidate patient queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await queryInvalidationManager.invalidatePatientQueries('patient-123');

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.patients.detail('patient-123'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.medications.byPatient('patient-123'),
      });
    });

    it('should handle smart invalidation', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await queryInvalidationManager.smartInvalidation(
        'patient_updated',
        'patient-123'
      );

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('Route Prefetching Hook', () => {
    const TestRoutePrefetching: React.FC = () => {
      useRoutePrefetching();
      return <div>Route prefetching active</div>;
    };

    it('should initialize route prefetching', () => {
      render(
        <TestWrapper>
          <TestRoutePrefetching />
        </TestWrapper>
      );

      expect(screen.getByText('Route prefetching active')).toBeInTheDocument();
    });
  });

  describe('Performance Monitoring', () => {
    it('should record query performance metrics', () => {
      QueryPerformanceMonitor.recordMetric('test-query', 150);
      QueryPerformanceMonitor.recordMetric('test-query', 200);
      QueryPerformanceMonitor.recordMetric('test-query', 100);

      const stats = QueryPerformanceMonitor.getQueryStats('test-query');

      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.average).toBe(150);
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
    });

    it('should track multiple queries', () => {
      QueryPerformanceMonitor.recordMetric('query-1', 100);
      QueryPerformanceMonitor.recordMetric('query-2', 200);

      const allStats = QueryPerformanceMonitor.getAllStats();

      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats['query-1']?.average).toBe(100);
      expect(allStats['query-2']?.average).toBe(200);
    });
  });

  describe('Network Awareness', () => {
    it('should not retry when offline', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const retryFn = queryClient.getDefaultOptions().queries?.retry as Function;
      
      expect(retryFn(1, { response: { status: 500 } })).toBe(false);
    });

    it('should retry when online', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const retryFn = queryClient.getDefaultOptions().queries?.retry as Function;
      
      expect(retryFn(1, { response: { status: 500 } })).toBe(true);
    });
  });
});

describe('Query Configuration Presets', () => {
  it('should provide different configurations for different data types', async () => {
    const { queryConfigs } = await import('../lib/queryConfig');

    // Real-time data should have short stale time
    expect(queryConfigs.realTime.staleTime).toBe(0);
    expect(queryConfigs.realTime.refetchInterval).toBe(30 * 1000);

    // Static data should have long stale time
    expect(queryConfigs.static.staleTime).toBe(60 * 60 * 1000);
    expect(queryConfigs.static.refetchInterval).toBe(false);

    // Critical data should refetch on focus
    expect(queryConfigs.critical.refetchOnWindowFocus).toBe(true);
    expect(queryConfigs.critical.keepPreviousData).toBe(true);
  });
});

describe('Integration Tests', () => {
  it('should work end-to-end with real query flow', async () => {
    const TestApp: React.FC = () => {
      const { data, isLoading } = useOptimizedQuery({
        queryKey: ['integration-test'],
        queryFn: async () => {
          const response = await fetch('/api/integration-test');
          if (!response.ok) throw new Error('Integration test failed');
          return response.json();
        },
        criticalData: true,
      });

      if (isLoading) return <div>Loading integration test...</div>;
      return <div>Integration test: {data?.message}</div>;
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'success' }),
    });

    render(
      <TestWrapper>
        <TestApp />
      </TestWrapper>
    );

    expect(screen.getByText('Loading integration test...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Integration test: success')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith('/api/integration-test');
  });
});