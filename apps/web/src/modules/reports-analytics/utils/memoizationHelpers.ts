// Memoization Utilities for Expensive Calculations and Chart Rendering
import { useMemo, useCallback, useRef, useEffect } from 'react';
import { ChartData, ChartConfig } from '../types/charts';

// Generic memoization function with TTL support
export function memoizeWithTTL<T extends (...args: any[]) => any>(
    fn: T,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
): T {
    const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();

    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);
        const now = Date.now();
        const cached = cache.get(key);

        if (cached && now - cached.timestamp < ttl) {
            return cached.value;
        }

        const result = fn(...args);
        cache.set(key, { value: result, timestamp: now });

        // Clean up expired entries
        for (const [cacheKey, cacheValue] of cache.entries()) {
            if (now - cacheValue.timestamp >= ttl) {
                cache.delete(cacheKey);
            }
        }

        return result;
    }) as T;
}

// Memoized data aggregation functions
export const memoizedAggregations = {
    // Sum calculation with memoization
    sum: memoizeWithTTL((data: number[]): number => {
        return data.reduce((acc, val) => acc + val, 0);
    }),

    // Average calculation with memoization
    average: memoizeWithTTL((data: number[]): number => {
        if (data.length === 0) return 0;
        return data.reduce((acc, val) => acc + val, 0) / data.length;
    }),

    // Median calculation with memoization
    median: memoizeWithTTL((data: number[]): number => {
        if (data.length === 0) return 0;
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }),

    // Standard deviation calculation with memoization
    standardDeviation: memoizeWithTTL((data: number[]): number => {
        if (data.length === 0) return 0;
        const avg = data.reduce((acc, val) => acc + val, 0) / data.length;
        const squaredDiffs = data.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / data.length;
        return Math.sqrt(avgSquaredDiff);
    }),

    // Percentile calculation with memoization
    percentile: memoizeWithTTL((data: number[], percentile: number): number => {
        if (data.length === 0) return 0;
        const sorted = [...data].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (upper >= sorted.length) return sorted[sorted.length - 1];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }),

    // Group by calculation with memoization
    groupBy: memoizeWithTTL(<T, K extends keyof T>(
        data: T[],
        key: K
    ): Record<string, T[]> => {
        return data.reduce((groups, item) => {
            const groupKey = String(item[key]);
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {} as Record<string, T[]>);
    }),

    // Time series aggregation with memoization
    aggregateByTimeInterval: memoizeWithTTL((
        data: Array<{ timestamp: Date; value: number }>,
        interval: 'hour' | 'day' | 'week' | 'month'
    ): Array<{ timestamp: Date; value: number; count: number }> => {
        const groups: Record<string, { values: number[]; timestamp: Date }> = {};

        data.forEach(item => {
            let key: string;
            const date = new Date(item.timestamp);

            switch (interval) {
                case 'hour':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
                    break;
                case 'day':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${date.getMonth()}`;
                    break;
                default:
                    key = date.toISOString();
            }

            if (!groups[key]) {
                groups[key] = { values: [], timestamp: date };
            }
            groups[key].values.push(item.value);
        });

        return Object.values(groups).map(group => ({
            timestamp: group.timestamp,
            value: group.values.reduce((sum, val) => sum + val, 0) / group.values.length,
            count: group.values.length,
        }));
    }),
};

// React hooks for memoized calculations
export function useMemoizedCalculation<T>(
    calculation: () => T,
    dependencies: React.DependencyList,
    ttl?: number
): T {
    const memoizedFn = useMemo(() => {
        if (ttl) {
            return memoizeWithTTL(calculation, ttl);
        }
        return calculation;
    }, [ttl]);

    return useMemo(() => memoizedFn(), dependencies);
}

// Hook for memoized chart data processing
export function useMemoizedChartData(
    rawData: any[],
    config: ChartConfig,
    transformFn?: (data: any[]) => any[]
): ChartData {
    return useMemo(() => {
        const processedData = transformFn ? transformFn(rawData) : rawData;

        return {
            type: config.type || 'line',
            data: processedData,
            config,
        };
    }, [rawData, config, transformFn]);
}

// Hook for memoized data filtering and sorting
export function useMemoizedDataProcessing<T>(
    data: T[],
    filters: Record<string, any>,
    sortConfig?: { key: keyof T; direction: 'asc' | 'desc' }
): T[] {
    return useMemo(() => {
        let result = [...data];

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value != null && value !== '') {
                result = result.filter(item => {
                    const itemValue = (item as any)[key];
                    if (typeof value === 'string') {
                        return String(itemValue).toLowerCase().includes(value.toLowerCase());
                    }
                    return itemValue === value;
                });
            }
        });

        // Apply sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return 1;
                if (bValue == null) return -1;

                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    comparison = aValue.getTime() - bValue.getTime();
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }

                return sortConfig.direction === 'desc' ? -comparison : comparison;
            });
        }

        return result;
    }, [data, filters, sortConfig]);
}

// Hook for debounced calculations
export function useDebouncedMemo<T>(
    factory: () => T,
    deps: React.DependencyList,
    delay: number = 300
): T | undefined {
    const [debouncedValue, setDebouncedValue] = React.useState<T | undefined>(undefined);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(factory());
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [...deps, delay]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedValue;
}

// Performance monitoring for expensive operations
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
    fn: T,
    name: string
): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
        const start = performance.now();
        const result = fn(...args);
        const end = performance.now();

        if (end - start > 100) { // Log if operation takes more than 100ms
            console.warn(`Slow operation detected: ${name} took ${(end - start).toFixed(2)}ms`);
        }

        return result;
    }) as T;
}

// Cache for expensive chart calculations
class ChartCalculationCache {
    private cache = new Map<string, { value: any; timestamp: number }>();
    private ttl = 5 * 60 * 1000; // 5 minutes

    get<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    set(key: string, value: any): void {
        this.cache.set(key, { value, timestamp: Date.now() });
        this.cleanup();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

export const chartCalculationCache = new ChartCalculationCache();

// Memoized chart data transformations
export const memoizedChartTransforms = {
    // Transform data for line/area charts
    timeSeriesTransform: memoizeWithTTL((
        data: Array<{ date: string | Date; value: number;[key: string]: any }>,
        dateFormat?: string
    ) => {
        return data.map(item => ({
            ...item,
            date: typeof item.date === 'string' ? new Date(item.date) : item.date,
            formattedDate: typeof item.date === 'string'
                ? new Date(item.date).toLocaleDateString()
                : item.date.toLocaleDateString(),
        }));
    }),

    // Transform data for pie/donut charts
    pieChartTransform: memoizeWithTTL((
        data: Array<{ name: string; value: number;[key: string]: any }>,
        threshold?: number
    ) => {
        const sorted = [...data].sort((a, b) => b.value - a.value);

        if (!threshold) return sorted;

        const significant = sorted.filter(item => item.value >= threshold);
        const others = sorted.filter(item => item.value < threshold);

        if (others.length === 0) return significant;

        const othersSum = others.reduce((sum, item) => sum + item.value, 0);
        return [
            ...significant,
            { name: 'Others', value: othersSum, isOthers: true }
        ];
    }),

    // Transform data for bar charts
    barChartTransform: memoizeWithTTL((
        data: Array<{ category: string; value: number;[key: string]: any }>,
        sortBy?: 'value' | 'category'
    ) => {
        if (!sortBy) return data;

        return [...data].sort((a, b) => {
            if (sortBy === 'value') {
                return b.value - a.value;
            }
            return a.category.localeCompare(b.category);
        });
    }),

    // Transform data for scatter plots
    scatterPlotTransform: memoizeWithTTL((
        data: Array<{ x: number; y: number;[key: string]: any }>,
        outlierThreshold?: number
    ) => {
        if (!outlierThreshold) return data;

        const xValues = data.map(d => d.x);
        const yValues = data.map(d => d.y);

        const xMean = xValues.reduce((sum, val) => sum + val, 0) / xValues.length;
        const yMean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length;

        const xStd = Math.sqrt(
            xValues.reduce((sum, val) => sum + Math.pow(val - xMean, 2), 0) / xValues.length
        );
        const yStd = Math.sqrt(
            yValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0) / yValues.length
        );

        return data.map(item => ({
            ...item,
            isOutlier:
                Math.abs(item.x - xMean) > outlierThreshold * xStd ||
                Math.abs(item.y - yMean) > outlierThreshold * yStd,
        }));
    }),
};

// React import fix
import React from 'react';