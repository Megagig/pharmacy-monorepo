/**
 * Performance Test Configuration
 * Centralized configuration for all performance tests and budgets
 */

export const PERFORMANCE_BUDGETS = {
  // Theme switching performance
  THEME_TOGGLE_MAX_TIME: 16, // 16ms (1 frame at 60fps)
  THEME_TOGGLE_AVERAGE_TIME: 12, // 12ms average
  THEME_TOGGLE_CONSISTENCY_THRESHOLD: 5, // 5ms standard deviation
  
  // Bundle size budgets
  BUNDLE_SIZE_MAX_GZIP: 500 * 1024, // 500KB total
  CHUNK_SIZE_MAX_GZIP: 200 * 1024, // 200KB per chunk
  MAIN_CHUNK_MAX_GZIP: 150 * 1024, // 150KB main chunk
  VENDOR_CHUNK_MAX_GZIP: 300 * 1024, // 300KB vendor chunk
  BUNDLE_REGRESSION_THRESHOLD: 5, // 5% regression threshold
  
  // API latency budgets
  API_LATENCY_P50_MAX: 200, // 200ms p50
  API_LATENCY_P95_MAX: 500, // 500ms p95
  API_LATENCY_P99_MAX: 1000, // 1000ms p99
  API_TIMEOUT: 5000, // 5s timeout
  
  // Web Vitals budgets
  LCP_TARGET: 2500, // 2.5s Largest Contentful Paint
  FID_TARGET: 100, // 100ms First Input Delay
  CLS_TARGET: 0.1, // 0.1 Cumulative Layout Shift
  FCP_TARGET: 1800, // 1.8s First Contentful Paint
  TTFB_TARGET: 600, // 600ms Time to First Byte
  
  // Lighthouse performance budgets
  LIGHTHOUSE_PERFORMANCE_MIN: 90, // Minimum Lighthouse performance score
  LIGHTHOUSE_ACCESSIBILITY_MIN: 95, // Minimum accessibility score
  LIGHTHOUSE_BEST_PRACTICES_MIN: 90, // Minimum best practices score
  LIGHTHOUSE_SEO_MIN: 90, // Minimum SEO score
  
  // Memory usage budgets
  MEMORY_HEAP_MAX: 50 * 1024 * 1024, // 50MB heap size
  MEMORY_LEAK_THRESHOLD: 10 * 1024 * 1024, // 10MB leak threshold
  
  // Network performance
  CACHE_HIT_RATE_MIN: 80, // 80% cache hit rate
  COMPRESSION_RATIO_MIN: 60, // 60% compression ratio
};

export const TEST_TIMEOUTS = {
  THEME_PERFORMANCE: 30000, // 30s for theme performance tests
  BUNDLE_ANALYSIS: 60000, // 60s for bundle analysis
  API_LOAD_TEST: 120000, // 2min for API load tests
  VISUAL_REGRESSION: 180000, // 3min for visual regression tests
  LIGHTHOUSE_TEST: 300000, // 5min for Lighthouse tests
};

export const PERFORMANCE_TEST_CONFIG = {
  // Theme performance test configuration
  theme: {
    toggleCount: 10,
    warmupToggles: 3,
    measurementRuns: 5,
    cooldownTime: 100, // ms between tests
  },
  
  // Bundle size test configuration
  bundle: {
    buildDir: 'dist',
    assetsDir: 'dist/assets',
    analysisTimeout: 30000,
    compressionFormats: ['gzip', 'brotli'],
  },
  
  // API performance test configuration
  api: {
    baseUrl: process.env.VITE_API_URL || 'http://localhost:3001',
    endpoints: [
      '/api/patients',
      '/api/notes',
      '/api/analytics',
      '/api/performance/metrics',
    ],
    loadTestDuration: 60000, // 1 minute
    concurrentUsers: [10, 50, 100, 200],
    requestTimeout: 5000,
  },
  
  // Visual regression test configuration
  visual: {
    viewports: [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ],
    browsers: ['chromium', 'firefox', 'webkit'],
    screenshotOptions: {
      fullPage: true,
      animations: 'disabled',
      threshold: 0.2, // 20% difference threshold
    },
  },
  
  // Web Vitals test configuration
  webVitals: {
    sampleSize: 10,
    measurementInterval: 1000, // 1s
    reportingThreshold: {
      good: 0.75, // 75% of measurements should be "good"
      needsImprovement: 0.9, // 90% should be at least "needs improvement"
    },
  },
};

export const PERFORMANCE_THRESHOLDS = {
  // Performance score thresholds
  excellent: 90,
  good: 75,
  needsImprovement: 50,
  poor: 0,
  
  // Regression detection thresholds
  significantRegression: 10, // 10% regression is significant
  minorRegression: 5, // 5% regression is minor
  improvement: -5, // 5% improvement
  
  // Consistency thresholds
  lowVariance: 5, // Low variance in measurements
  mediumVariance: 15, // Medium variance
  highVariance: 25, // High variance (concerning)
};

export const ERROR_MESSAGES = {
  THEME_TOGGLE_SLOW: 'Theme toggle exceeded 16ms budget',
  BUNDLE_SIZE_EXCEEDED: 'Bundle size exceeded budget',
  API_LATENCY_HIGH: 'API latency exceeded budget',
  WEB_VITALS_POOR: 'Web Vitals metrics below target',
  LIGHTHOUSE_SCORE_LOW: 'Lighthouse score below minimum',
  MEMORY_LEAK_DETECTED: 'Memory leak detected',
  CACHE_HIT_RATE_LOW: 'Cache hit rate below target',
  VISUAL_REGRESSION_DETECTED: 'Visual regression detected',
  PERFORMANCE_REGRESSION: 'Performance regression detected',
  TEST_TIMEOUT: 'Performance test timed out',
};

export const PERFORMANCE_CATEGORIES = {
  THEME: 'theme',
  BUNDLE: 'bundle',
  API: 'api',
  WEB_VITALS: 'webVitals',
  LIGHTHOUSE: 'lighthouse',
  MEMORY: 'memory',
  NETWORK: 'network',
  VISUAL: 'visual',
} as const;

export type PerformanceCategory = typeof PERFORMANCE_CATEGORIES[keyof typeof PERFORMANCE_CATEGORIES];

export interface PerformanceTestResult {
  category: PerformanceCategory;
  name: string;
  value: number;
  budget: number;
  passed: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: number;
  buildId?: string;
  branch?: string;
  commit?: string;
  results: PerformanceTestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallScore: number;
    budgetCompliance: boolean;
  };
  trends?: {
    category: PerformanceCategory;
    trend: 'improving' | 'stable' | 'degrading';
    changePercent: number;
  }[];
}