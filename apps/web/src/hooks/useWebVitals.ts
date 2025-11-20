import { useEffect, useState, useCallback } from 'react';
import { WebVitalsMonitor, WebVitalsMetrics, WebVitalsEntry } from '../utils/WebVitalsMonitor';

export interface UseWebVitalsOptions {
  enabled?: boolean;
  apiEndpoint?: string;
  performanceBudgets?: Record<string, number>;
  onBudgetExceeded?: (entry: WebVitalsEntry, budget: number) => void;
}

export interface UseWebVitalsReturn {
  metrics: WebVitalsMetrics;
  isMonitoring: boolean;
  budgetViolations: Array<{ entry: WebVitalsEntry; budget: number }>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearViolations: () => void;
}

export const useWebVitals = (options: UseWebVitalsOptions = {}): UseWebVitalsReturn => {
  const [monitor, setMonitor] = useState<WebVitalsMonitor | null>(null);
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({
    FCP: 0,
    LCP: 0,
    CLS: 0,
    FID: 0,
    TTFB: 0,
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [budgetViolations, setBudgetViolations] = useState<Array<{ entry: WebVitalsEntry; budget: number }>>([]);

  const handleBudgetExceeded = useCallback((event: CustomEvent) => {
    const { entry, budget } = event.detail;
    setBudgetViolations(prev => [...prev, { entry, budget }]);
    options.onBudgetExceeded?.(entry, budget);
  }, [options.onBudgetExceeded]);

  useEffect(() => {
    if (options.enabled !== false) {
      const webVitalsMonitor = new WebVitalsMonitor({
        apiEndpoint: options.apiEndpoint,
        performanceBudgets: options.performanceBudgets,
        enabled: true,
      });
      
      setMonitor(webVitalsMonitor);
      setIsMonitoring(true);

      // Listen for budget violations
      window.addEventListener('performance-budget-exceeded', handleBudgetExceeded as EventListener);

      // Update metrics periodically
      const interval = setInterval(() => {
        setMetrics(webVitalsMonitor.getMetrics());
      }, 1000);

      return () => {
        clearInterval(interval);
        window.removeEventListener('performance-budget-exceeded', handleBudgetExceeded as EventListener);
        webVitalsMonitor.disable();
      };
    }
  }, [options.enabled, options.apiEndpoint, options.performanceBudgets, handleBudgetExceeded]);

  const startMonitoring = useCallback(() => {
    if (monitor) {
      monitor.enable();
      setIsMonitoring(true);
    }
  }, [monitor]);

  const stopMonitoring = useCallback(() => {
    if (monitor) {
      monitor.disable();
      setIsMonitoring(false);
    }
  }, [monitor]);

  const clearViolations = useCallback(() => {
    setBudgetViolations([]);
  }, []);

  return {
    metrics,
    isMonitoring,
    budgetViolations,
    startMonitoring,
    stopMonitoring,
    clearViolations,
  };
};