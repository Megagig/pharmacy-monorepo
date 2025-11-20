import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface LatencyMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  statusCode: number;
  userAgent?: string;
  ip?: string;
}

class LatencyTracker {
  private metrics: LatencyMetric[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory

  addMetric(metric: LatencyMetric): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow requests
    if (metric.duration > 1000) { // > 1 second
      console.warn(`Slow API request detected: ${metric.method} ${metric.endpoint} took ${metric.duration}ms`);
    }
  }

  getMetrics(endpoint?: string, limit: number = 100): LatencyMetric[] {
    let filtered = this.metrics;

    if (endpoint) {
      filtered = this.metrics.filter(m => m.endpoint === endpoint);
    }

    return filtered.slice(-limit);
  }

  getStats(endpoint?: string): {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  } {
    let filtered = this.metrics;

    if (endpoint) {
      filtered = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filtered.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;

    return {
      count,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
      avg: durations.reduce((sum, d) => sum + d, 0) / count,
      min: durations[0],
      max: durations[count - 1],
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  getTopEndpoints(limit: number = 10): Array<{
    endpoint: string;
    count: number;
    avgDuration: number;
    p95Duration: number;
  }> {
    const endpointStats = new Map<string, LatencyMetric[]>();

    // Group metrics by endpoint
    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!endpointStats.has(key)) {
        endpointStats.set(key, []);
      }
      endpointStats.get(key)!.push(metric);
    });

    // Calculate stats for each endpoint
    const results = Array.from(endpointStats.entries()).map(([endpoint, metrics]) => {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const p95Duration = this.percentile(durations, 95);

      return {
        endpoint,
        count: metrics.length,
        avgDuration,
        p95Duration,
      };
    });

    // Sort by request count and return top endpoints
    return results
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

// Singleton instance
const latencyTracker = new LatencyTracker();

export const latencyMeasurementMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): Response<any, Record<string, any>> {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Create latency metric
    const metric: LatencyMetric = {
      endpoint: req.route?.path || req.path,
      method: req.method,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      timestamp: new Date(),
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    // Add to tracker (do this after calling original end)
    setImmediate(() => {
      latencyTracker.addMetric(metric);
    });

    // Try to add response header only if headers haven't been sent
    try {
      if (!res.headersSent) {
        res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      }
    } catch (error) {
      // Ignore header setting errors
    }

    // Call original end method and return its result
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

export { latencyTracker, LatencyMetric };
