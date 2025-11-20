/**
 * Frontend Performance Optimization Utilities
 * Implements code splitting, lazy loading, caching, and performance monitoring
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { QueryClient } from '@tanstack/react-query';

// ===============================
// CODE SPLITTING AND LAZY LOADING
// ===============================

/**
 * Enhanced lazy loading with error boundaries and loading states
 */
export const createLazyComponent = <T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    fallback?: ComponentType
): LazyExoticComponent<T> => {
    return lazy(async () => {
        try {
            // Add artificial delay in development for testing
            if (process.env.NODE_ENV === 'development') {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const module = await importFn();
            return module;
        } catch (error) {
            console.error('Failed to load component:', error);

            // Return fallback component or error component
            if (fallback) {
                return { default: fallback };
            }

            // Return a simple error component
            return {
                default: () => (
                    <div className="p-4 text-center">
                        <p className="text-red-600">Failed to load component</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Retry
                        </button>
                    </div>
                )
            };
    }
  });
};

/**
 * Lazy-loaded Clinical Intervention components
 */
export const LazyComponents = {
    // Main dashboard
    ClinicalInterventionDashboard: createLazyComponent(
        () => import('../components/ClinicalInterventionDashboard')
    ),

    // Forms and modals
    InterventionForm: createLazyComponent(
        () => import('../components/InterventionForm')
    ),

    InterventionDetails: createLazyComponent(
        () => import('../components/InterventionDetails')
    ),

    // Workflow components
    IssueIdentificationStep: createLazyComponent(
        () => import('../components/workflow/IssueIdentificationStep')
    ),

    StrategyRecommendationStep: createLazyComponent(
        () => import('../components/workflow/StrategyRecommendationStep')
    ),

    TeamCollaborationStep: createLazyComponent(
        () => import('../components/workflow/TeamCollaborationStep')
    ),

    OutcomeTrackingStep: createLazyComponent(
        () => import('../components/workflow/OutcomeTrackingStep')
    ),

    // Reports and analytics
    ClinicalInterventionReports: createLazyComponent(
        () => import('../components/ClinicalInterventionReports')
    ),

    ClinicalInterventionAuditTrail: createLazyComponent(
        () => import('../components/ClinicalInterventionAuditTrail')
    ),

    ClinicalInterventionComplianceReport: createLazyComponent(
        () => import('../components/ClinicalInterventionComplianceReport')
    ),
};

// ===============================
// CACHING STRATEGIES
// ===============================

/**
 * Enhanced query client configuration for optimal caching
 */
export const createOptimizedQueryClient = (): QueryClient => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Cache for 5 minutes by default
                staleTime: 5 * 60 * 1000,

                // Keep data in cache for 10 minutes after component unmount
                gcTime: 10 * 60 * 1000,

                // Retry failed requests
                retry: (failureCount, error: any) => {
                    // Don't retry on 4xx errors (client errors)
                    if (error?.response?.status >= 400 && error?.response?.status < 500) {
                        return false;
                    }

                    // Retry up to 3 times for other errors
                    return failureCount < 3;
                },

                // Retry delay with exponential backoff
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

                // Refetch on window focus for critical data
                refetchOnWindowFocus: (query) => {
                    // Only refetch dashboard and active intervention data
                    return query.queryKey.includes('dashboard') ||
                        query.queryKey.includes('active-interventions');
                },

                // Network mode for offline support
                networkMode: 'offlineFirst',
            },

            mutations: {
                // Retry mutations once
                retry: 1,

                // Network mode for mutations
                networkMode: 'online',
            },
        },
    });
};

/**
 * Cache key generators for consistent caching
 */
export const CacheKeys = {
    // Intervention queries
    interventions: (filters?: any) => ['interventions', filters],
    intervention: (id: string) => ['intervention', id],
    interventionDetails: (id: string) => ['intervention-details', id],

    // Patient-related
    patientInterventions: (patientId: string) => ['patient-interventions', patientId],
    patientSummary: (patientId: string) => ['patient-summary', patientId],

    // User-related
    userAssignments: (userId: string, status?: string[]) => ['user-assignments', userId, status],

    // Dashboard and analytics
    dashboard: (workplaceId: string, dateRange?: any) => ['dashboard', workplaceId, dateRange],
    analytics: (workplaceId: string, filters?: any) => ['analytics', workplaceId, filters],

    // Reports
    outcomeReport: (filters: any) => ['outcome-report', filters],
    complianceReport: (filters: any) => ['compliance-report', filters],

    // Lookup data (longer cache)
    strategies: () => ['strategies'],
    categories: () => ['categories'],
    users: (workplaceId: string) => ['users', workplaceId],
    patients: (workplaceId: string, search?: string) => ['patients', workplaceId, search],
};

/**
 * Cache invalidation utilities
 */
export class CacheManager {
    private queryClient: QueryClient;

    constructor(queryClient: QueryClient) {
        this.queryClient = queryClient;
    }

    /**
     * Invalidate intervention-related caches
     */
    async invalidateInterventionCaches(interventionId?: string, patientId?: string): Promise<void> {
        const promises: Promise<void>[] = [];

        // Invalidate intervention lists
        promises.push(this.queryClient.invalidateQueries({ queryKey: ['interventions'] }));

        // Invalidate dashboard data
        promises.push(this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }));

        // Invalidate analytics
        promises.push(this.queryClient.invalidateQueries({ queryKey: ['analytics'] }));

        if (interventionId) {
            // Invalidate specific intervention
            promises.push(this.queryClient.invalidateQueries({
                queryKey: ['intervention', interventionId]
            }));
            promises.push(this.queryClient.invalidateQueries({
                queryKey: ['intervention-details', interventionId]
            }));
        }

        if (patientId) {
            // Invalidate patient-related caches
            promises.push(this.queryClient.invalidateQueries({
                queryKey: ['patient-interventions', patientId]
            }));
            promises.push(this.queryClient.invalidateQueries({
                queryKey: ['patient-summary', patientId]
            }));
        }

        await Promise.all(promises);
    }

    /**
     * Prefetch related data
     */
    async prefetchRelatedData(interventionId: string): Promise<void> {
        // This would prefetch related patient data, user assignments, etc.
        // Implementation depends on specific use cases
    }

    /**
     * Clear all intervention caches
     */
    async clearAllCaches(): Promise<void> {
        await this.queryClient.clear();
    }
}

// ===============================
// PERFORMANCE MONITORING
// ===============================

export interface PerformanceMetric {
    name: string;
    value: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

export class PerformanceMonitor {
    private static metrics: PerformanceMetric[] = [];
    private static maxMetrics = 1000;

    /**
     * Record performance metric
     */
    static recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            metadata,
        });

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    /**
     * Measure component render time
     */
    static measureRender<T>(
        componentName: string,
        renderFn: () => T,
        metadata?: Record<string, any>
    ): T {
        const startTime = performance.now();
        const result = renderFn();
        const endTime = performance.now();

        this.recordMetric(`render_${componentName}`, endTime - startTime, metadata);

        return result;
    }

    /**
     * Measure async operation time
     */
    static async measureAsync<T>(
        operationName: string,
        asyncFn: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        const startTime = performance.now();

        try {
            const result = await asyncFn();
            const endTime = performance.now();

            this.recordMetric(`async_${operationName}`, endTime - startTime, {
                ...metadata,
                success: true,
            });

            return result;
        } catch (error) {
            const endTime = performance.now();

            this.recordMetric(`async_${operationName}`, endTime - startTime, {
                ...metadata,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Get performance statistics
     */
    static getStats(metricName?: string): {
        count: number;
        average: number;
        min: number;
        max: number;
        recent: number[];
    } {
        let filteredMetrics = this.metrics;

        if (metricName) {
            filteredMetrics = this.metrics.filter(m => m.name === metricName);
        }

        if (filteredMetrics.length === 0) {
            return { count: 0, average: 0, min: 0, max: 0, recent: [] };
        }

        const values = filteredMetrics.map(m => m.value);
        const recent = filteredMetrics.slice(-10).map(m => m.value);

        return {
            count: values.length,
            average: values.reduce((sum, val) => sum + val, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            recent,
        };
    }

    /**
     * Monitor Core Web Vitals
     */
    static monitorWebVitals(): void {
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordMetric('lcp', entry.startTime, {
                    element: entry.element?.tagName,
                });
            }
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordMetric('fid', entry.processingStart - entry.startTime, {
                    eventType: entry.name,
                });
            }
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    this.recordMetric('cls', entry.value);
                }
            }
        }).observe({ entryTypes: ['layout-shift'] });
    }

    /**
     * Export metrics for analysis
     */
    static exportMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Clear metrics
     */
    static clearMetrics(): void {
        this.metrics = [];
    }
}

// ===============================
// MEMORY OPTIMIZATION
// ===============================

export class MemoryOptimizer {
    /**
     * Optimize large intervention lists for rendering
     */
    static optimizeInterventionList(interventions: any[]): any[] {
        return interventions.map(intervention => ({
            _id: intervention._id,
            interventionNumber: intervention.interventionNumber,
            category: intervention.category,
            priority: intervention.priority,
            status: intervention.status,
            identifiedDate: intervention.identifiedDate,

            // Optimized patient info
            patient: intervention.patient ? {
                _id: intervention.patient._id,
                displayName: `${intervention.patient.firstName} ${intervention.patient.lastName}`,
                mrn: intervention.patient.mrn,
            } : null,

            // Optimized user info
            identifiedBy: intervention.identifiedByUser ? {
                _id: intervention.identifiedByUser._id,
                displayName: `${intervention.identifiedByUser.firstName} ${intervention.identifiedByUser.lastName}`,
            } : null,

            // Summary fields
            issuePreview: intervention.issueDescription?.substring(0, 100) +
                (intervention.issueDescription?.length > 100 ? '...' : ''),
            assignmentCount: intervention.assignments?.length || 0,
            strategyCount: intervention.strategies?.length || 0,
            hasOutcome: !!intervention.outcomes,

            // Essential dates
            startedAt: intervention.startedAt,
            completedAt: intervention.completedAt,
            updatedAt: intervention.updatedAt,
        }));
    }

    /**
     * Implement virtual scrolling for large lists
     */
    static calculateVirtualScrolling(
        totalItems: number,
        containerHeight: number,
        itemHeight: number,
        scrollTop: number
    ): {
        startIndex: number;
        endIndex: number;
        visibleItems: number;
        offsetY: number;
    } {
        const visibleItems = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleItems + 1, totalItems - 1);
        const offsetY = startIndex * itemHeight;

        return {
            startIndex,
            endIndex,
            visibleItems,
            offsetY,
        };
    }

    /**
     * Debounce function for search and filters
     */
    static debounce<T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): (...args: Parameters<T>) => void {
        let timeoutId: NodeJS.Timeout;

        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    }

    /**
     * Throttle function for scroll events
     */
    static throttle<T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): (...args: Parameters<T>) => void {
        let lastCall = 0;

        return (...args: Parameters<T>) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                func(...args);
            }
        };
    }
}

// ===============================
// BUNDLE OPTIMIZATION
// ===============================

export class BundleOptimizer {
    /**
     * Preload critical resources
     */
    static preloadCriticalResources(): void {
        // Preload critical CSS
        const criticalCSS = document.createElement('link');
        criticalCSS.rel = 'preload';
        criticalCSS.as = 'style';
        criticalCSS.href = '/critical.css';
        document.head.appendChild(criticalCSS);

        // Preload critical fonts
        const criticalFont = document.createElement('link');
        criticalFont.rel = 'preload';
        criticalFont.as = 'font';
        criticalFont.type = 'font/woff2';
        criticalFont.href = '/fonts/inter-var.woff2';
        criticalFont.crossOrigin = 'anonymous';
        document.head.appendChild(criticalFont);
    }

    /**
     * Implement resource hints
     */
    static addResourceHints(): void {
        // DNS prefetch for external resources
        const dnsPrefetch = document.createElement('link');
        dnsPrefetch.rel = 'dns-prefetch';
        dnsPrefetch.href = '//api.example.com';
        document.head.appendChild(dnsPrefetch);

        // Preconnect to critical origins
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = 'https://api.example.com';
        document.head.appendChild(preconnect);
    }

    /**
     * Optimize images with lazy loading
     */
    static optimizeImages(): void {
        const images = document.querySelectorAll('img[data-src]');

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    img.src = img.dataset.src!;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// ===============================
// INITIALIZATION
// ===============================

export const initializePerformanceOptimization = (): void => {
    // Monitor Core Web Vitals
    PerformanceMonitor.monitorWebVitals();

    // Optimize bundle loading
    BundleOptimizer.preloadCriticalResources();
    BundleOptimizer.addResourceHints();
    BundleOptimizer.optimizeImages();

    // Log initialization

    // Clean up metrics periodically
    setInterval(() => {
        const stats = PerformanceMonitor.getStats();

        // Clear old metrics if too many
        if (stats.count > 5000) {
            PerformanceMonitor.clearMetrics();
        }
    }, 300000); // Every 5 minutes
};