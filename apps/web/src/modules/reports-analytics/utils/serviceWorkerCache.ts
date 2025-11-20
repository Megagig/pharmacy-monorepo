// Service Worker Cache Management for Reports & Analytics Module
import { ChartData } from '../types/charts';

// Cache configuration
const CACHE_CONFIG = {
    STATIC_CACHE: 'reports-analytics-static-v1',
    DATA_CACHE: 'reports-analytics-data-v1',
    CHART_CACHE: 'reports-analytics-charts-v1',
    TTL: {
        STATIC: 24 * 60 * 60 * 1000, // 24 hours
        DATA: 5 * 60 * 1000, // 5 minutes
        CHARTS: 10 * 60 * 1000, // 10 minutes
    },
};

// Cache interface
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

// Service Worker Cache Manager
class ServiceWorkerCacheManager {
    private isServiceWorkerSupported: boolean;

    constructor() {
        this.isServiceWorkerSupported = 'serviceWorker' in navigator && 'caches' in window;
        this.initializeServiceWorker();
    }

    private async initializeServiceWorker(): Promise<void> {
        if (!this.isServiceWorkerSupported) {
            console.warn('Service Worker not supported in this browser');
            return;
        }

        try {
            // Register service worker if not already registered
            if (!navigator.serviceWorker.controller) {
                await navigator.serviceWorker.register('/sw.js', {
                    scope: '/reports-analytics/',
                });
            }

            // Listen for service worker updates
            navigator.serviceWorker.addEventListener('controllerchange', () => {

                this.clearExpiredCaches();
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Cache static assets (CSS, JS, images)
    async cacheStaticAssets(urls: string[]): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        try {
            const cache = await caches.open(CACHE_CONFIG.STATIC_CACHE);
            await cache.addAll(urls);

        } catch (error) {
            console.error('Failed to cache static assets:', error);
        }
    }

    // Cache report data
    async cacheReportData(key: string, data: any, ttl?: number): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        try {
            const cache = await caches.open(CACHE_CONFIG.DATA_CACHE);
            const cacheEntry: CacheEntry = {
                data,
                timestamp: Date.now(),
                ttl: ttl || CACHE_CONFIG.TTL.DATA,
            };

            const response = new Response(JSON.stringify(cacheEntry), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `max-age=${Math.floor((ttl || CACHE_CONFIG.TTL.DATA) / 1000)}`,
                },
            });

            await cache.put(key, response);
        } catch (error) {
            console.error('Failed to cache report data:', error);
        }
    }

    // Get cached report data
    async getCachedReportData(key: string): Promise<any | null> {
        if (!this.isServiceWorkerSupported) return null;

        try {
            const cache = await caches.open(CACHE_CONFIG.DATA_CACHE);
            const response = await cache.match(key);

            if (!response) return null;

            const cacheEntry: CacheEntry = await response.json();
            const now = Date.now();

            // Check if cache entry is expired
            if (now - cacheEntry.timestamp > cacheEntry.ttl) {
                await cache.delete(key);
                return null;
            }

            return cacheEntry.data;
        } catch (error) {
            console.error('Failed to get cached report data:', error);
            return null;
        }
    }

    // Cache chart configurations and rendered data
    async cacheChartData(chartId: string, chartData: ChartData): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        try {
            const cache = await caches.open(CACHE_CONFIG.CHART_CACHE);
            const cacheEntry: CacheEntry = {
                data: chartData,
                timestamp: Date.now(),
                ttl: CACHE_CONFIG.TTL.CHARTS,
            };

            const response = new Response(JSON.stringify(cacheEntry), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `max-age=${Math.floor(CACHE_CONFIG.TTL.CHARTS / 1000)}`,
                },
            });

            await cache.put(`chart-${chartId}`, response);
        } catch (error) {
            console.error('Failed to cache chart data:', error);
        }
    }

    // Get cached chart data
    async getCachedChartData(chartId: string): Promise<ChartData | null> {
        if (!this.isServiceWorkerSupported) return null;

        try {
            const cache = await caches.open(CACHE_CONFIG.CHART_CACHE);
            const response = await cache.match(`chart-${chartId}`);

            if (!response) return null;

            const cacheEntry: CacheEntry = await response.json();
            const now = Date.now();

            if (now - cacheEntry.timestamp > cacheEntry.ttl) {
                await cache.delete(`chart-${chartId}`);
                return null;
            }

            return cacheEntry.data;
        } catch (error) {
            console.error('Failed to get cached chart data:', error);
            return null;
        }
    }

    // Clear expired caches
    async clearExpiredCaches(): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        try {
            const cacheNames = [CACHE_CONFIG.DATA_CACHE, CACHE_CONFIG.CHART_CACHE];

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                const now = Date.now();

                for (const request of keys) {
                    try {
                        const response = await cache.match(request);
                        if (response) {
                            const cacheEntry: CacheEntry = await response.json();
                            if (now - cacheEntry.timestamp > cacheEntry.ttl) {
                                await cache.delete(request);
                            }
                        }
                    } catch (error) {
                        // If we can't parse the cache entry, delete it
                        await cache.delete(request);
                    }
                }
            }

        } catch (error) {
            console.error('Failed to clear expired caches:', error);
        }
    }

    // Clear all caches
    async clearAllCaches(): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        try {
            const cacheNames = Object.values(CACHE_CONFIG).filter(name => typeof name === 'string');
            await Promise.all(cacheNames.map(name => caches.delete(name as string)));

        } catch (error) {
            console.error('Failed to clear all caches:', error);
        }
    }

    // Get cache statistics
    async getCacheStats(): Promise<{
        staticCacheSize: number;
        dataCacheSize: number;
        chartCacheSize: number;
        totalSize: number;
    }> {
        if (!this.isServiceWorkerSupported) {
            return { staticCacheSize: 0, dataCacheSize: 0, chartCacheSize: 0, totalSize: 0 };
        }

        try {
            const [staticCache, dataCache, chartCache] = await Promise.all([
                caches.open(CACHE_CONFIG.STATIC_CACHE),
                caches.open(CACHE_CONFIG.DATA_CACHE),
                caches.open(CACHE_CONFIG.CHART_CACHE),
            ]);

            const [staticKeys, dataKeys, chartKeys] = await Promise.all([
                staticCache.keys(),
                dataCache.keys(),
                chartCache.keys(),
            ]);

            return {
                staticCacheSize: staticKeys.length,
                dataCacheSize: dataKeys.length,
                chartCacheSize: chartKeys.length,
                totalSize: staticKeys.length + dataKeys.length + chartKeys.length,
            };
        } catch (error) {
            console.error('Failed to get cache stats:', error);
            return { staticCacheSize: 0, dataCacheSize: 0, chartCacheSize: 0, totalSize: 0 };
        }
    }

    // Preload critical resources
    async preloadCriticalResources(): Promise<void> {
        if (!this.isServiceWorkerSupported) return;

        const criticalResources = [
            '/static/css/reports-analytics.css',
            '/static/js/recharts.min.js',
            '/static/js/reports-analytics-bundle.js',
            '/static/images/chart-icons.svg',
        ];

        await this.cacheStaticAssets(criticalResources);
    }

    // Background sync for offline data
    async scheduleBackgroundSync(tag: string, data: any): Promise<void> {
        if (!this.isServiceWorkerSupported || !('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.ready;

            if ('sync' in registration) {
                // Store data for background sync
                await this.cacheReportData(`bg-sync-${tag}`, data, 24 * 60 * 60 * 1000); // 24 hours

                // Register background sync
                await (registration as any).sync.register(tag);

            }
        } catch (error) {
            console.error('Failed to schedule background sync:', error);
        }
    }
}

// Memory cache for immediate access
class MemoryCache {
    private cache = new Map<string, CacheEntry>();
    private maxSize = 100; // Maximum number of entries

    set(key: string, data: any, ttl: number = CACHE_CONFIG.TTL.DATA): void {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }

    // Clean expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

// React hooks for cache management
export function useCacheManager() {
    const [cacheManager] = React.useState(() => new ServiceWorkerCacheManager());
    const [memoryCache] = React.useState(() => new MemoryCache());

    // Cleanup memory cache periodically
    React.useEffect(() => {
        const interval = setInterval(() => {
            memoryCache.cleanup();
        }, 60000); // Every minute

        return () => clearInterval(interval);
    }, [memoryCache]);

    return { cacheManager, memoryCache };
}

// Hook for cached data fetching
export function useCachedData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
): {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
} {
    const [data, setData] = React.useState<T | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const { cacheManager, memoryCache } = useCacheManager();

    const fetchData = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Try memory cache first
            const memoryData = memoryCache.get(key);
            if (memoryData) {
                setData(memoryData);
                setLoading(false);
                return;
            }

            // Try service worker cache
            const cachedData = await cacheManager.getCachedReportData(key);
            if (cachedData) {
                setData(cachedData);
                memoryCache.set(key, cachedData, ttl);
                setLoading(false);
                return;
            }

            // Fetch fresh data
            const freshData = await fetchFn();
            setData(freshData);

            // Cache the fresh data
            memoryCache.set(key, freshData, ttl);
            await cacheManager.cacheReportData(key, freshData, ttl);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, [key, fetchFn, ttl, cacheManager, memoryCache]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
    };
}

// Export instances
export const cacheManager = new ServiceWorkerCacheManager();
export const memoryCache = new MemoryCache();

// Initialize critical resources caching
cacheManager.preloadCriticalResources();

// React import fix
import React from 'react';