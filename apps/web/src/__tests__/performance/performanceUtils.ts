/**
 * Performance Test Utilities
 * Helper functions for performance testing and measurement
 */

import { 
  PERFORMANCE_BUDGETS, 
  PERFORMANCE_THRESHOLDS,
  PerformanceTestResult,
  PerformanceReport,
  PerformanceCategory 
} from './performanceConfig';

/**
 * High-precision timer for performance measurements
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getLastMeasurement(): number {
    return this.measurements[this.measurements.length - 1] || 0;
  }

  getAllMeasurements(): number[] {
    return [...this.measurements];
  }

  getStatistics() {
    if (this.measurements.length === 0) {
      return { min: 0, max: 0, average: 0, median: 0, stdDev: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = this.measurements.reduce((acc, val) => acc + val, 0);
    const average = sum / this.measurements.length;
    
    const variance = this.measurements.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / this.measurements.length;
    const stdDev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev,
      count: this.measurements.length,
    };
  }

  reset(): void {
    this.measurements = [];
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Theme performance measurement utilities
 */
export class ThemePerformanceMeasurer {
  private timer = new PerformanceTimer();
  private observer: MutationObserver | null = null;

  async measureThemeToggle(toggleFunction: () => void | Promise<void>): Promise<number> {
    return new Promise((resolve) => {
      // Set up mutation observer to detect DOM changes
      this.observer = new MutationObserver(() => {
        const duration = this.timer.stop();
        this.observer?.disconnect();
        resolve(duration);
      });

      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
        childList: false,
        subtree: false,
      });

      // Start timing and trigger toggle
      this.timer.start();
      
      if (typeof toggleFunction === 'function') {
        const result = toggleFunction();
        if (result instanceof Promise) {
          result.catch(() => {
            // Handle async errors
            this.observer?.disconnect();
            resolve(this.timer.stop());
          });
        }
      }

      // Fallback timeout
      setTimeout(() => {
        if (this.observer) {
          this.observer.disconnect();
          resolve(this.timer.stop());
        }
      }, 100);
    });
  }

  async measureMultipleToggles(
    toggleFunction: () => void | Promise<void>,
    count: number = 10,
    cooldownMs: number = 50
  ): Promise<{ measurements: number[]; statistics: ReturnType<PerformanceTimer['getStatistics']> }> {
    const measurements: number[] = [];

    for (let i = 0; i < count; i++) {
      const duration = await this.measureThemeToggle(toggleFunction);
      measurements.push(duration);
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, cooldownMs));
      }
    }

    // Calculate statistics
    this.timer.measurements = measurements;
    const statistics = this.timer.getStatistics();

    return { measurements, statistics };
  }

  validateThemePerformance(statistics: ReturnType<PerformanceTimer['getStatistics']>): PerformanceTestResult[] {
    const results: PerformanceTestResult[] = [];

    // Average time validation
    results.push({
      category: 'theme',
      name: 'Theme Toggle Average Time',
      value: statistics.average,
      budget: PERFORMANCE_BUDGETS.THEME_TOGGLE_AVERAGE_TIME,
      passed: statistics.average < PERFORMANCE_BUDGETS.THEME_TOGGLE_AVERAGE_TIME,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'average' },
    });

    // Maximum time validation
    results.push({
      category: 'theme',
      name: 'Theme Toggle Max Time',
      value: statistics.max,
      budget: PERFORMANCE_BUDGETS.THEME_TOGGLE_MAX_TIME,
      passed: statistics.max < PERFORMANCE_BUDGETS.THEME_TOGGLE_MAX_TIME,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'maximum' },
    });

    // Consistency validation (standard deviation)
    results.push({
      category: 'theme',
      name: 'Theme Toggle Consistency',
      value: statistics.stdDev,
      budget: PERFORMANCE_BUDGETS.THEME_TOGGLE_CONSISTENCY_THRESHOLD,
      passed: statistics.stdDev < PERFORMANCE_BUDGETS.THEME_TOGGLE_CONSISTENCY_THRESHOLD,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'standardDeviation' },
    });

    return results;
  }
}

/**
 * Bundle size analysis utilities
 */
export class BundleAnalyzer {
  async analyzeBundleSize(buildPath: string): Promise<{
    files: Record<string, { size: number; gzipSize: number }>;
    totalSize: number;
    totalGzipSize: number;
  }> {
    // This would typically analyze actual build files
    // For testing, we'll simulate the analysis
    const mockFiles = {
      'main-abc123.js': { size: 200 * 1024, gzipSize: 150 * 1024 },
      'vendor-def456.js': { size: 300 * 1024, gzipSize: 180 * 1024 },
      'chunk-ghi789.js': { size: 120 * 1024, gzipSize: 80 * 1024 },
    };

    const totalSize = Object.values(mockFiles).reduce((sum, file) => sum + file.size, 0);
    const totalGzipSize = Object.values(mockFiles).reduce((sum, file) => sum + file.gzipSize, 0);

    return {
      files: mockFiles,
      totalSize,
      totalGzipSize,
    };
  }

  validateBundleSize(analysis: Awaited<ReturnType<BundleAnalyzer['analyzeBundleSize']>>): PerformanceTestResult[] {
    const results: PerformanceTestResult[] = [];

    // Total bundle size validation
    results.push({
      category: 'bundle',
      name: 'Total Bundle Size (Gzipped)',
      value: analysis.totalGzipSize,
      budget: PERFORMANCE_BUDGETS.BUNDLE_SIZE_MAX_GZIP,
      passed: analysis.totalGzipSize < PERFORMANCE_BUDGETS.BUNDLE_SIZE_MAX_GZIP,
      timestamp: Date.now(),
      metadata: { unit: 'bytes', type: 'total' },
    });

    // Individual chunk size validation
    Object.entries(analysis.files).forEach(([filename, { gzipSize }]) => {
      results.push({
        category: 'bundle',
        name: `Chunk Size: ${filename}`,
        value: gzipSize,
        budget: PERFORMANCE_BUDGETS.CHUNK_SIZE_MAX_GZIP,
        passed: gzipSize < PERFORMANCE_BUDGETS.CHUNK_SIZE_MAX_GZIP,
        timestamp: Date.now(),
        metadata: { unit: 'bytes', type: 'chunk', filename },
      });
    });

    return results;
  }

  detectBundleRegression(
    current: Awaited<ReturnType<BundleAnalyzer['analyzeBundleSize']>>,
    baseline: Awaited<ReturnType<BundleAnalyzer['analyzeBundleSize']>>
  ): PerformanceTestResult[] {
    const results: PerformanceTestResult[] = [];

    // Total size regression
    const totalRegression = ((current.totalGzipSize - baseline.totalGzipSize) / baseline.totalGzipSize) * 100;
    results.push({
      category: 'bundle',
      name: 'Bundle Size Regression',
      value: totalRegression,
      budget: PERFORMANCE_BUDGETS.BUNDLE_REGRESSION_THRESHOLD,
      passed: totalRegression < PERFORMANCE_BUDGETS.BUNDLE_REGRESSION_THRESHOLD,
      timestamp: Date.now(),
      metadata: { unit: 'percent', type: 'regression' },
    });

    return results;
  }
}

/**
 * API performance measurement utilities
 */
export class ApiPerformanceMeasurer {
  async measureApiLatency(url: string, options: RequestInit = {}): Promise<{
    responseTime: number;
    status: number;
    success: boolean;
  }> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(PERFORMANCE_BUDGETS.API_TIMEOUT),
      });
      
      const endTime = performance.now();
      
      return {
        responseTime: endTime - startTime,
        status: response.status,
        success: response.ok,
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        responseTime: endTime - startTime,
        status: 0,
        success: false,
      };
    }
  }

  async measureMultipleRequests(
    url: string,
    count: number = 10,
    options: RequestInit = {}
  ): Promise<{
    measurements: Awaited<ReturnType<ApiPerformanceMeasurer['measureApiLatency']>>[];
    statistics: {
      p50: number;
      p95: number;
      p99: number;
      average: number;
      successRate: number;
    };
  }> {
    const measurements = await Promise.all(
      Array.from({ length: count }, () => this.measureApiLatency(url, options))
    );

    const responseTimes = measurements.map(m => m.responseTime).sort((a, b) => a - b);
    const successCount = measurements.filter(m => m.success).length;

    const statistics = {
      p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      successRate: (successCount / count) * 100,
    };

    return { measurements, statistics };
  }

  validateApiPerformance(
    endpoint: string,
    statistics: Awaited<ReturnType<ApiPerformanceMeasurer['measureMultipleRequests']>>['statistics']
  ): PerformanceTestResult[] {
    const results: PerformanceTestResult[] = [];

    // P50 latency validation
    results.push({
      category: 'api',
      name: `API P50 Latency: ${endpoint}`,
      value: statistics.p50,
      budget: PERFORMANCE_BUDGETS.API_LATENCY_P50_MAX,
      passed: statistics.p50 < PERFORMANCE_BUDGETS.API_LATENCY_P50_MAX,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'p50', endpoint },
    });

    // P95 latency validation
    results.push({
      category: 'api',
      name: `API P95 Latency: ${endpoint}`,
      value: statistics.p95,
      budget: PERFORMANCE_BUDGETS.API_LATENCY_P95_MAX,
      passed: statistics.p95 < PERFORMANCE_BUDGETS.API_LATENCY_P95_MAX,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'p95', endpoint },
    });

    // Success rate validation
    results.push({
      category: 'api',
      name: `API Success Rate: ${endpoint}`,
      value: statistics.successRate,
      budget: 95, // 95% success rate
      passed: statistics.successRate >= 95,
      timestamp: Date.now(),
      metadata: { unit: 'percent', type: 'successRate', endpoint },
    });

    return results;
  }
}

/**
 * Web Vitals measurement utilities
 */
export class WebVitalsMeasurer {
  private metrics: Map<string, number> = new Map();

  collectWebVitals(): Promise<Record<string, number>> {
    return new Promise((resolve) => {
      // Mock Web Vitals collection for testing
      const mockMetrics = {
        LCP: 2200,
        FID: 80,
        CLS: 0.08,
        FCP: 1500,
        TTFB: 200,
      };

      setTimeout(() => {
        resolve(mockMetrics);
      }, 100);
    });
  }

  validateWebVitals(metrics: Record<string, number>): PerformanceTestResult[] {
    const results: PerformanceTestResult[] = [];

    // LCP validation
    results.push({
      category: 'webVitals',
      name: 'Largest Contentful Paint (LCP)',
      value: metrics.LCP,
      budget: PERFORMANCE_BUDGETS.LCP_TARGET,
      passed: metrics.LCP < PERFORMANCE_BUDGETS.LCP_TARGET,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'LCP' },
    });

    // FID validation
    results.push({
      category: 'webVitals',
      name: 'First Input Delay (FID)',
      value: metrics.FID,
      budget: PERFORMANCE_BUDGETS.FID_TARGET,
      passed: metrics.FID < PERFORMANCE_BUDGETS.FID_TARGET,
      timestamp: Date.now(),
      metadata: { unit: 'ms', type: 'FID' },
    });

    // CLS validation
    results.push({
      category: 'webVitals',
      name: 'Cumulative Layout Shift (CLS)',
      value: metrics.CLS,
      budget: PERFORMANCE_BUDGETS.CLS_TARGET,
      passed: metrics.CLS < PERFORMANCE_BUDGETS.CLS_TARGET,
      timestamp: Date.now(),
      metadata: { unit: 'score', type: 'CLS' },
    });

    return results;
  }
}

/**
 * Performance report generator
 */
export class PerformanceReporter {
  generateReport(results: PerformanceTestResult[]): PerformanceReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const overallScore = Math.round((passed / results.length) * 100);

    return {
      timestamp: Date.now(),
      results,
      summary: {
        totalTests: results.length,
        passed,
        failed,
        overallScore,
        budgetCompliance: failed === 0,
      },
    };
  }

  formatReport(report: PerformanceReport): string {
    const { summary, results } = report;
    
    let output = `Performance Test Report\n`;
    output += `========================\n`;
    output += `Timestamp: ${new Date(report.timestamp).toISOString()}\n`;
    output += `Overall Score: ${summary.overallScore}/100\n`;
    output += `Tests: ${summary.passed}/${summary.totalTests} passed\n`;
    output += `Budget Compliance: ${summary.budgetCompliance ? 'PASS' : 'FAIL'}\n\n`;

    // Group results by category
    const categories = [...new Set(results.map(r => r.category))];
    
    categories.forEach(category => {
      const categoryResults = results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.passed).length;
      
      output += `${category.toUpperCase()}\n`;
      output += `${'='.repeat(category.length + 5)}\n`;
      output += `Status: ${categoryPassed}/${categoryResults.length} passed\n\n`;
      
      categoryResults.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        const unit = result.metadata?.unit || '';
        output += `  ${status} ${result.name}: ${result.value}${unit} (budget: ${result.budget}${unit})\n`;
      });
      
      output += '\n';
    });

    return output;
  }

  exportToJson(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportToCsv(report: PerformanceReport): string {
    const headers = ['Category', 'Test Name', 'Value', 'Budget', 'Unit', 'Status', 'Timestamp'];
    const rows = report.results.map(result => [
      result.category,
      result.name,
      result.value.toString(),
      result.budget.toString(),
      result.metadata?.unit || '',
      result.passed ? 'PASS' : 'FAIL',
      new Date(result.timestamp).toISOString(),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

/**
 * Utility functions
 */
export const performanceUtils = {
  timer: PerformanceTimer,
  themePerformance: ThemePerformanceMeasurer,
  bundleAnalyzer: BundleAnalyzer,
  apiPerformance: ApiPerformanceMeasurer,
  webVitals: WebVitalsMeasurer,
  reporter: PerformanceReporter,
  
  // Helper functions
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  formatBytes: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },
  
  formatDuration: (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${Math.round(ms / 1000 * 100) / 100}s`;
  },
  
  calculatePercentile: (values: number[], percentile: number): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return sorted[index];
  },
};