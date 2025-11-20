interface PerformanceMetric {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
}

interface PerformanceMark {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

/**
 * Performance monitoring utility for Communication Hub
 */
export class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private marks: Map<string, PerformanceMark> = new Map();
    private observers: PerformanceObserver[] = [];
    private isEnabled: boolean = true;

    constructor() {
        this.initializeObservers();
    }

    /**
     * Initialize performance observers
     */
    private initializeObservers(): void {
        if (typeof window === 'undefined' || !window.PerformanceObserver) {
            return;
        }

        try {
            // Observe navigation timing
            const navObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.entryType === 'navigation') {
                        const navEntry = entry as PerformanceNavigationTiming;
                        this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.navigationStart);
                        this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.navigationStart);
                        this.recordMetric('first_paint', navEntry.responseStart - navEntry.navigationStart);
                    }
                });
            });
            navObserver.observe({ entryTypes: ['navigation'] });
            this.observers.push(navObserver);

            // Observe resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.entryType === 'resource') {
                        const resourceEntry = entry as PerformanceResourceTiming;
                        this.recordMetric('resource_load_time', resourceEntry.duration, {
                            resource_type: resourceEntry.initiatorType,
                            resource_name: resourceEntry.name,
                        });
                    }
                });
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.push(resourceObserver);

            // Observe largest contentful paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                    this.recordMetric('largest_contentful_paint', lastEntry.startTime);
                }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);

            // Observe first input delay
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    this.recordMetric('first_input_delay', entry.processingStart - entry.startTime);
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            this.observers.push(fidObserver);

            // Observe cumulative layout shift
            const clsObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                let clsValue = 0;
                entries.forEach((entry) => {
                    if (!(entry as any).hadRecentInput) {
                        clsValue += (entry as any).value;
                    }
                });
                if (clsValue > 0) {
                    this.recordMetric('cumulative_layout_shift', clsValue);
                }
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(clsObserver);

        } catch (error) {
            console.warn('Failed to initialize performance observers:', error);
        }
    }

    /**
     * Record a performance metric
     */
    recordMetric(name: string, value: number, tags?: Record<string, string>): void {
        if (!this.isEnabled) return;

        const metric: PerformanceMetric = {
            name,
            value,
            timestamp: Date.now(),
            tags,
        };

        this.metrics.push(metric);

        // Keep only last 1000 metrics to prevent memory leaks
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }

        // Performance logs disabled - metrics are still collected and can be accessed via getMetrics()
        // Uncomment below to enable console logging in development
        // if (process.env.NODE_ENV === 'development') {
        // }
    }

    /**
     * Start a performance measurement
     */
    startMeasurement(name: string): void {
        if (!this.isEnabled) return;

        const mark: PerformanceMark = {
            name,
            startTime: performance.now(),
        };

        this.marks.set(name, mark);

        // Use native performance API if available
        if (performance.mark) {
            performance.mark(`${name}_start`);
        }
    }

    /**
     * End a performance measurement
     */
    endMeasurement(name: string, tags?: Record<string, string>): number | null {
        if (!this.isEnabled) return null;

        const mark = this.marks.get(name);
        if (!mark) {
            console.warn(`No measurement started for: ${name}`);
            return null;
        }

        const endTime = performance.now();
        const duration = endTime - mark.startTime;

        mark.endTime = endTime;
        mark.duration = duration;

        this.recordMetric(name, duration, tags);

        // Use native performance API if available
        if (performance.mark && performance.measure) {
            performance.mark(`${name}_end`);
            performance.measure(name, `${name}_start`, `${name}_end`);
        }

        this.marks.delete(name);
        return duration;
    }

    /**
     * Measure a function execution time
     */
    async measureFunction<T>(
        name: string,
        fn: () => T | Promise<T>,
        tags?: Record<string, string>
    ): Promise<T> {
        this.startMeasurement(name);
        try {
            const result = await fn();
            this.endMeasurement(name, tags);
            return result;
        } catch (error) {
            this.endMeasurement(name, { ...tags, error: 'true' });
            throw error;
        }
    }

    /**
     * Measure React component render time
     */
    measureRender(componentName: string): {
        onRenderStart: () => void;
        onRenderEnd: () => void;
    } {
        let renderStartTime: number;

        return {
            onRenderStart: () => {
                renderStartTime = performance.now();
            },
            onRenderEnd: () => {
                if (renderStartTime) {
                    const renderTime = performance.now() - renderStartTime;
                    this.recordMetric('component_render_time', renderTime, {
                        component: componentName,
                    });
                }
            },
        };
    }

    /**
     * Measure memory usage
     */
    measureMemory(): void {
        if (!this.isEnabled) return;

        if ('memory' in performance) {
            const memory = (performance as any).memory;
            this.recordMetric('memory_used_js_heap', memory.usedJSHeapSize / 1024 / 1024);
            this.recordMetric('memory_total_js_heap', memory.totalJSHeapSize / 1024 / 1024);
            this.recordMetric('memory_js_heap_limit', memory.jsHeapSizeLimit / 1024 / 1024);
        }
    }

    /**
     * Measure network timing for API calls
     */
    measureApiCall(url: string, method: string = 'GET'): {
        onStart: () => void;
        onEnd: (status: number, size?: number) => void;
        onError: (error: Error) => void;
    } {
        let startTime: number;
        const measurementName = `api_call_${method}_${url}`;

        return {
            onStart: () => {
                startTime = performance.now();
            },
            onEnd: (status: number, size?: number) => {
                if (startTime) {
                    const duration = performance.now() - startTime;
                    this.recordMetric('api_call_duration', duration, {
                        url,
                        method,
                        status: status.toString(),
                        size: size ? size.toString() : undefined,
                    });
                }
            },
            onError: (error: Error) => {
                if (startTime) {
                    const duration = performance.now() - startTime;
                    this.recordMetric('api_call_duration', duration, {
                        url,
                        method,
                        error: error.message,
                        status: 'error',
                    });
                }
            },
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics(filter?: {
        name?: string;
        since?: number;
        tags?: Record<string, string>;
    }): PerformanceMetric[] {
        let filteredMetrics = this.metrics;

        if (filter) {
            if (filter.name) {
                filteredMetrics = filteredMetrics.filter(m => m.name === filter.name);
            }

            if (filter.since) {
                filteredMetrics = filteredMetrics.filter(m => m.timestamp >= filter.since!);
            }

            if (filter.tags) {
                filteredMetrics = filteredMetrics.filter(m => {
                    if (!m.tags) return false;
                    return Object.entries(filter.tags!).every(([key, value]) => m.tags![key] === value);
                });
            }
        }

        return filteredMetrics;
    }

    /**
     * Get performance statistics
     */
    getStats(metricName: string): {
        count: number;
        min: number;
        max: number;
        avg: number;
        p50: number;
        p95: number;
        p99: number;
    } | null {
        const metrics = this.getMetrics({ name: metricName });

        if (metrics.length === 0) {
            return null;
        }

        const values = metrics.map(m => m.value).sort((a, b) => a - b);
        const count = values.length;
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count,
            min: values[0],
            max: values[count - 1],
            avg: sum / count,
            p50: values[Math.floor(count * 0.5)],
            p95: values[Math.floor(count * 0.95)],
            p99: values[Math.floor(count * 0.99)],
        };
    }

    /**
     * Export metrics for analysis
     */
    exportMetrics(): string {
        return JSON.stringify({
            timestamp: Date.now(),
            metrics: this.metrics,
            userAgent: navigator.userAgent,
            url: window.location.href,
        }, null, 2);
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics = [];
        this.marks.clear();
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Cleanup observers
     */
    destroy(): void {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        this.clearMetrics();
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Communication-specific performance helpers
export const communicationPerformance = {
    measureMessageRender: (messageId: string) =>
        performanceMonitor.measureRender(`message_${messageId}`),

    measureConversationLoad: (conversationId: string) =>
        performanceMonitor.measureFunction(
            'conversation_load',
            async () => {
                // This would be called when loading a conversation
            },
            { conversationId }
        ),

    measureMessageSend: (conversationId: string) =>
        performanceMonitor.measureFunction(
            'message_send',
            async () => {
                // This would be called when sending a message
            },
            { conversationId }
        ),

    measureVirtualization: (listType: 'messages' | 'conversations', itemCount: number) => {
        const measurement = performanceMonitor.measureRender(`virtualized_${listType}`);
        performanceMonitor.recordMetric(`virtualization_item_count`, itemCount, {
            list_type: listType,
        });
        return measurement;
    },
};