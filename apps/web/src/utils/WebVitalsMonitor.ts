import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals';

export interface WebVitalsMetrics {
  FCP: number; // First Contentful Paint
  LCP: number; // Largest Contentful Paint
  CLS: number; // Cumulative Layout Shift
  FID: number; // First Input Delay
  TTFB: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

export interface WebVitalsEntry {
  name: string;
  value: number;
  id: string;
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
}

export class WebVitalsMonitor {
  private metrics: Map<string, number> = new Map();
  private apiEndpoint: string;
  private performanceBudgets: Record<string, number>;
  private isEnabled: boolean;

  constructor(options: {
    apiEndpoint?: string;
    performanceBudgets?: Record<string, number>;
    enabled?: boolean;
  } = {}) {
    // Use backend URL for API endpoints
    const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://PharmaPilot-nttq.onrender.com';
    this.apiEndpoint = options.apiEndpoint || `${backendUrl}/api/analytics/web-vitals`;
    this.performanceBudgets = options.performanceBudgets || {
      CLS: 0.1,
      FID: 100,
      FCP: 1800,
      LCP: 2500,
      TTFB: 800,
      INP: 200,
    };
    this.isEnabled = options.enabled !== false;

    if (this.isEnabled) {
      this.initializeMetrics();
    }
  }

  private initializeMetrics(): void {
    try {
      // Collect Core Web Vitals
      onCLS(this.handleMetric.bind(this));
      onFCP(this.handleMetric.bind(this));
      onLCP(this.handleMetric.bind(this));
      onTTFB(this.handleMetric.bind(this));
      
      // Collect INP (Interaction to Next Paint) - newer metric
      onINP(this.handleMetric.bind(this));
    } catch (error) {
      console.warn('Failed to initialize Web Vitals monitoring:', error);
    }
  }

  private handleMetric(metric: Metric): void {
    try {
      this.metrics.set(metric.name, metric.value);
      
      // Create Web Vitals entry
      const entry: WebVitalsEntry = {
        name: metric.name,
        value: metric.value,
        id: metric.id,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: this.getConnectionType(),
      };

      // Send to analytics service
      this.sendToAnalytics(entry);
      
      // Check performance budgets
      this.checkPerformanceBudgets(entry);
      
      // Log to console in development
      if (import.meta.env.DEV) {

      }
    } catch (error) {
      console.warn('Failed to handle Web Vitals metric:', error);
    }
  }

  private getConnectionType(): string | undefined {
    // @ts-ignore - navigator.connection is not in TypeScript types
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType;
  }

  private async sendToAnalytics(entry: WebVitalsEntry): Promise<void> {
    try {
      // Use sendBeacon for reliability, fallback to fetch
      const data = JSON.stringify(entry);
      
      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(this.apiEndpoint, blob);
      } else {
        // Fallback to fetch with keepalive
        fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        }).catch(error => {
          console.warn('Failed to send Web Vitals data:', error);
        });
      }
    } catch (error) {
      console.warn('Failed to send Web Vitals data:', error);
    }
  }

  private checkPerformanceBudgets(entry: WebVitalsEntry): void {
    const budget = this.performanceBudgets[entry.name];
    
    if (budget && entry.value > budget) {
      console.warn(
        `Performance budget exceeded for ${entry.name}: ${entry.value} > ${budget}`
      );
      
      // Send performance alert
      this.sendPerformanceAlert(entry, budget);
      
      // Dispatch custom event for application to handle
      window.dispatchEvent(new CustomEvent('performance-budget-exceeded', {
        detail: { entry, budget }
      }));
    }
  }

  private async sendPerformanceAlert(entry: WebVitalsEntry, budget: number): Promise<void> {
    try {
      const alertData = {
        type: 'performance_budget_exceeded',
        metric: entry.name,
        value: entry.value,
        budget,
        url: entry.url,
        timestamp: entry.timestamp,
        userAgent: entry.userAgent,
        connectionType: entry.connectionType,
      };

      const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://PharmaPilot-nttq.onrender.com';
      fetch(`${backendUrl}/api/alerts/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(alertData),
        keepalive: true,
      }).catch(error => {
        console.warn('Failed to send performance alert:', error);
      });
    } catch (error) {
      console.warn('Failed to send performance alert:', error);
    }
  }

  public getMetrics(): WebVitalsMetrics {
    return {
      FCP: this.metrics.get('FCP') || 0,
      LCP: this.metrics.get('LCP') || 0,
      CLS: this.metrics.get('CLS') || 0,
      FID: this.metrics.get('FID') || 0,
      TTFB: this.metrics.get('TTFB') || 0,
      INP: this.metrics.get('INP'),
    };
  }

  public updateBudgets(budgets: Partial<Record<string, number>>): void {
    this.performanceBudgets = { ...this.performanceBudgets, ...budgets };
  }

  public enable(): void {
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.initializeMetrics();
    }
  }

  public disable(): void {
    this.isEnabled = false;
    this.metrics.clear();
  }

  // Static method for easy initialization
  static init(options?: {
    apiEndpoint?: string;
    performanceBudgets?: Record<string, number>;
    enabled?: boolean;
  }): WebVitalsMonitor {
    return new WebVitalsMonitor(options);
  }
}

// Export singleton instance for easy use
export const webVitalsMonitor = WebVitalsMonitor.init();