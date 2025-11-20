/**
 * Route-based prefetching hook for optimized navigation
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, queryPrefetcher } from '../lib/queryClient';
import { apiFetch } from '../utils/fetchWrapper';

/**
 * Hook to prefetch data based on current route and likely navigation paths
 */
export function useRoutePrefetching() {
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchForRoute = async () => {
      const currentPath = location.pathname;

      try {
        // Dashboard route - prefetch common destinations
        if (currentPath === '/dashboard') {
          await Promise.allSettled([
            // Prefetch patient list (most common navigation from dashboard)
            queryClient.prefetchQuery({
              queryKey: queryKeys.patients.lists(),
              queryFn: async () => {
                const response = await apiFetch('/api/patients?limit=20');
                if (!response.ok) throw new Error('Failed to prefetch patients');
                return response.json();
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // Prefetch recent clinical notes
            queryClient.prefetchQuery({
              queryKey: ['clinical-notes', 'recent'],
              queryFn: async () => {
                const response = await apiFetch('/api/clinical-notes?limit=10&sort=recent');
                if (!response.ok) throw new Error('Failed to prefetch clinical notes');
                return response.json();
              },
              staleTime: 1 * 60 * 1000, // 1 minute
            }),

            // Prefetch notifications
            queryClient.prefetchQuery({
              queryKey: queryKeys.user.notifications(true),
              queryFn: async () => {
                const baseURL = import.meta.env.MODE === 'development'
                  ? 'http://localhost:5000/api'
                  : (import.meta.env.VITE_API_BASE_URL || '/api');
                const response = await fetch(`${baseURL}/notifications?unread=true`, {
                  credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to prefetch notifications');
                return response.json();
              },
              staleTime: 30 * 1000, // 30 seconds
            }),
          ]);
        }

        // Patients list route - prefetch patient details for first few patients
        else if (currentPath === '/patients') {
          // Get cached patient list
          const cachedPatients = queryClient.getQueryData(queryKeys.patients.lists());

          if (cachedPatients && Array.isArray(cachedPatients)) {
            // Prefetch details for first 3 patients
            const baseURL = import.meta.env.MODE === 'development'
              ? 'http://localhost:5000/api'
              : '/api';
            const prefetchPromises = cachedPatients.slice(0, 3).map((patient: any) =>
              queryClient.prefetchQuery({
                queryKey: queryKeys.patients.detail(patient._id),
                queryFn: async () => {
                  const response = await fetch(`${baseURL}/patients/${patient._id}`, {
                    credentials: 'include'
                  });
                  if (!response.ok) throw new Error('Failed to prefetch patient details');
                  return response.json();
                },
                staleTime: 5 * 60 * 1000, // 5 minutes
              })
            );

            await Promise.allSettled(prefetchPromises);
          }
        }

        // Patient detail route - prefetch related data
        else if (currentPath.match(/^\/patients\/[^/]+$/)) {
          const patientId = currentPath.split('/')[2];

          if (patientId) {
            await queryPrefetcher.prefetchPatientData(patientId);
          }
        }

        // Clinical notes route - prefetch form data
        else if (currentPath === '/notes') {
          await Promise.allSettled([
            // Prefetch patients for note creation
            queryClient.prefetchQuery({
              queryKey: queryKeys.patients.lists(),
              queryFn: async () => {
                const response = await apiFetch('/api/patients?limit=50');
                if (!response.ok) throw new Error('Failed to prefetch patients');
                return response.json();
              },
              staleTime: 5 * 60 * 1000,
            }),

            // Prefetch note templates
            queryClient.prefetchQuery({
              queryKey: ['clinical-notes', 'templates'],
              queryFn: async () => {
                const response = await apiFetch('/api/clinical-notes/templates');
                if (!response.ok) throw new Error('Failed to prefetch templates');
                return response.json();
              },
              staleTime: 30 * 60 * 1000, // 30 minutes - templates don't change often
            }),
          ]);
        }

        // Medications route - prefetch drug information
        else if (currentPath === '/medications') {
          await Promise.allSettled([
            // Prefetch common medications
            queryClient.prefetchQuery({
              queryKey: ['medications', 'common'],
              queryFn: async () => {
                const response = await apiFetch('/api/medications/common');
                if (!response.ok) throw new Error('Failed to prefetch common medications');
                return response.json();
              },
              staleTime: 60 * 60 * 1000, // 1 hour - common medications are stable
            }),

            // Prefetch drug interaction checker data
            queryClient.prefetchQuery({
              queryKey: ['drug-interactions', 'checker-data'],
              queryFn: async () => {
                const response = await apiFetch('/api/drug-interactions/checker-data');
                if (!response.ok) throw new Error('Failed to prefetch interaction data');
                return response.json();
              },
              staleTime: 24 * 60 * 60 * 1000, // 24 hours - reference data
            }),
          ]);
        }

        // Reports route - prefetch dashboard data
        else if (currentPath === '/reports-analytics') {
          await Promise.allSettled([
            // Prefetch report templates
            queryClient.prefetchQuery({
              queryKey: ['reports', 'templates'],
              queryFn: async () => {
                const response = await fetch('/api/reports/templates');
                if (!response.ok) throw new Error('Failed to prefetch report templates');
                return response.json();
              },
              staleTime: 30 * 60 * 1000, // 30 minutes
            }),

            // Prefetch recent reports
            queryClient.prefetchQuery({
              queryKey: ['reports', 'recent'],
              queryFn: async () => {
                const response = await fetch('/api/reports?limit=10&sort=recent');
                if (!response.ok) throw new Error('Failed to prefetch recent reports');
                return response.json();
              },
              staleTime: 5 * 60 * 1000, // 5 minutes
            }),
          ]);
        }

      } catch (error) {
        // Silently handle prefetch errors - they shouldn't break the app
        console.warn('Route prefetching error:', error);
      }
    };

    // Debounce prefetching to avoid excessive requests
    const timeoutId = setTimeout(prefetchForRoute, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname, queryClient]);
}

/**
 * Hook for prefetching on hover/focus (for navigation links)
 */
export function useLinkPrefetching() {
  const queryClient = useQueryClient();

  const prefetchRoute = async (path: string) => {
    try {
      // Prefetch based on destination route
      if (path === '/patients') {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.patients.lists(),
          queryFn: async () => {
            const response = await fetch('/api/patients?limit=20');
            if (!response.ok) throw new Error('Failed to prefetch patients');
            return response.json();
          },
          staleTime: 2 * 60 * 1000,
        });
      } else if (path === '/notes') {
        await queryClient.prefetchQuery({
          queryKey: ['clinical-notes', 'list'],
          queryFn: async () => {
            const response = await fetch('/api/clinical-notes?limit=20');
            if (!response.ok) throw new Error('Failed to prefetch clinical notes');
            return response.json();
          },
          staleTime: 2 * 60 * 1000,
        });
      } else if (path === '/medications') {
        await queryClient.prefetchQuery({
          queryKey: ['medications', 'list'],
          queryFn: async () => {
            const response = await fetch('/api/medications?limit=20');
            if (!response.ok) throw new Error('Failed to prefetch medications');
            return response.json();
          },
          staleTime: 2 * 60 * 1000,
        });
      }
    } catch (error) {
      console.warn('Link prefetching error:', error);
    }
  };

  return { prefetchRoute };
}

/**
 * Hook for background data synchronization
 */
export function useBackgroundSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Sync critical data every 2 minutes
    const syncInterval = setInterval(() => {
      // Only sync if the tab is visible
      if (!document.hidden) {
        // Refetch critical queries
        queryClient.refetchQueries({
          queryKey: ['dashboard'],
          type: 'active',
        });

        queryClient.refetchQueries({
          queryKey: ['notifications'],
          type: 'active',
        });

        // Refetch any stale queries
        queryClient.refetchQueries({
          stale: true,
          type: 'active',
        });
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(syncInterval);
  }, [queryClient]);

  // Sync when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refetch stale queries when tab becomes visible
        queryClient.refetchQueries({
          stale: true,
          type: 'active',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);
}

/**
 * Hook for intelligent cache warming
 */
export function useCacheWarming() {
  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    // Only warm cache on authenticated routes (not public routes)
    const isPublicRoute = location.pathname.startsWith('/patient-portal') ||
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/register') ||
      location.pathname === '/';

    if (isPublicRoute) {
      return; // Skip cache warming on public routes
    }

    // Warm cache with commonly accessed data during idle time
    const warmCache = async () => {
      // Use requestIdleCallback if available
      const scheduleWork = (window as any).requestIdleCallback || setTimeout;

      scheduleWork(async () => {
        try {
          // Check if we have auth cookies before attempting to warm cache
          const hasAuthCookie = document.cookie.includes('accessToken') ||
            document.cookie.includes('refreshToken');

          if (!hasAuthCookie) {
            return; // Skip if no auth cookies
          }

          // Warm user profile cache
          await queryClient.prefetchQuery({
            queryKey: queryKeys.user.profile(),
            queryFn: async () => {
              const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
              const response = await fetch(`${base}/api/user/settings/profile`, {
                credentials: 'include',
              });
              if (!response.ok) return null; // Silently fail - user not authenticated
              const data = await response.json();
              return data.data; // Extract user data from response
            },
            staleTime: 10 * 60 * 1000,
          });

          // Warm workspace settings cache
          await queryClient.prefetchQuery({
            queryKey: queryKeys.workspace.settings(),
            queryFn: async () => {
              const base = import.meta.env.MODE === 'development' ? 'http://localhost:5000' : '';
              const response = await fetch(`${base}/api/workspace/settings`, {
                credentials: 'include',
              });
              if (!response.ok) return null; // Silently fail - user not authenticated
              return response.json();
            },
            staleTime: 30 * 60 * 1000,
          });

        } catch (error) {
          // Silently ignore errors on public routes
          console.debug('Cache warming skipped:', error);
        }
      });
    };

    // Start cache warming after a short delay
    const timeoutId = setTimeout(warmCache, 2000);

    return () => clearTimeout(timeoutId);
  }, [queryClient, location.pathname]);
}