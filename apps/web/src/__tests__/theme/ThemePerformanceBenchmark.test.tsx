import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThemeProvider from '../../components/providers/ThemeProvider';
import ThemeToggle from '../../components/common/ThemeToggle';
import { useTheme } from '../../stores/themeStore';

// Performance benchmark utility
class PerformanceBenchmark {
  private measurements: number[] = [];
  private startTime: number = 0;

  start() {
    this.startTime = performance.now();
  }

  end(): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, m) => sum + m, 0) / this.measurements.length;
  }

  getMedian(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  getP95(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  getMin(): number {
    return this.measurements.length > 0 ? Math.min(...this.measurements) : 0;
  }

  getMax(): number {
    return this.measurements.length > 0 ? Math.max(...this.measurements) : 0;
  }

  reset() {
    this.measurements = [];
    this.startTime = 0;
  }

  getStats() {
    return {
      count: this.measurements.length,
      average: this.getAverage(),
      median: this.getMedian(),
      p95: this.getP95(),
      min: this.getMin(),
      max: this.getMax(),
      measurements: [...this.measurements],
    };
  }
}

// Test component for performance benchmarking
const BenchmarkTestComponent: React.FC = () => {
  const { 
    theme, 
    resolvedTheme, 
    toggleTheme, 
    getPerformanceReport,
    getLastToggleTime,
    getAverageToggleTime 
  } = useTheme();
  
  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary transition-theme">
      {/* Complex layout to stress test theme switching */}
      <header className="bg-theme-secondary border-b border-theme-primary p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-theme-primary">Performance Test</h1>
          <div className="flex items-center space-x-4">
            <span className="text-theme-secondary">Theme: {theme}</span>
            <span className="text-theme-secondary">Resolved: {resolvedTheme}</span>
            <button 
              data-testid="theme-toggle-button"
              onClick={toggleTheme}
              className="button-theme-primary px-4 py-2 rounded"
            >
              Toggle Theme
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Performance metrics display */}
        <section className="mb-8 p-6 bg-theme-secondary rounded-lg border border-theme-primary">
          <h2 className="text-xl font-semibold text-theme-primary mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-theme-tertiary rounded border border-theme-secondary">
              <h3 className="font-medium text-theme-primary">Last Toggle</h3>
              <p className="text-2xl font-bold text-theme-accent" data-testid="last-toggle-time">
                {getLastToggleTime()?.toFixed(2) || 'N/A'}ms
              </p>
            </div>
            <div className="p-4 bg-theme-tertiary rounded border border-theme-secondary">
              <h3 className="font-medium text-theme-primary">Average Toggle</h3>
              <p className="text-2xl font-bold text-theme-accent" data-testid="average-toggle-time">
                {getAverageToggleTime().toFixed(2)}ms
              </p>
            </div>
            <div className="p-4 bg-theme-tertiary rounded border border-theme-secondary">
              <h3 className="font-medium text-theme-primary">Performance Report</h3>
              <div className="text-sm text-theme-secondary" data-testid="performance-report">
                {JSON.stringify(getPerformanceReport())}
              </div>
            </div>
          </div>
        </section>

        {/* Large grid to stress test rendering */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-theme-primary mb-4">Stress Test Grid</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 100 }, (_, i) => (
              <div
                key={i}
                className="card-theme p-3 rounded border border-theme-primary transition-theme"
              >
                <div className="w-full h-16 bg-theme-accent rounded mb-2"></div>
                <p className="text-xs text-theme-secondary">Item {i + 1}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Complex nested components */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-theme-primary mb-4">Nested Components</h2>
          <div className="space-y-4">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="card-theme p-4 rounded border border-theme-primary">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-theme-primary">Component {i + 1}</h3>
                  <span className="px-2 py-1 bg-theme-accent text-white rounded text-xs">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-tertiary rounded border border-theme-secondary">
                    <p className="text-sm text-theme-secondary">Nested content</p>
                  </div>
                  <div className="p-3 bg-theme-tertiary rounded border border-theme-secondary">
                    <p className="text-sm text-theme-secondary">More content</p>
                  </div>
                  <div className="p-3 bg-theme-tertiary rounded border border-theme-secondary">
                    <p className="text-sm text-theme-secondary">Even more content</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

describe('Theme Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;
  let originalPerformance: Performance;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
    
    // Ensure high-resolution timing
    originalPerformance = global.performance;
    
    // Clear localStorage and DOM
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    global.performance = originalPerformance;
    
    // Clean up DOM
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-mode');
  });

  describe('Single Theme Toggle Performance', () => {
    it('should toggle theme within 16ms target (60fps)', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform single toggle with measurement
      benchmark.start();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const duration = benchmark.end();
      
      // Should complete within 16ms (1 frame at 60fps)
      expect(duration).toBeLessThan(16);
      
      // Log performance for debugging
      console.log(`Single toggle completed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain sub-10ms performance for optimal UX', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform single toggle
      benchmark.start();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const duration = benchmark.end();
      
      // Optimal performance target
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Multiple Toggle Performance', () => {
    it('should maintain consistent performance across 10 toggles', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform 10 toggles
      for (let i = 0; i < 10; i++) {
        benchmark.start();
        
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        benchmark.end();
        
        // Small delay between toggles
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const stats = benchmark.getStats();
      
      // All toggles should be under 16ms
      expect(stats.max).toBeLessThan(16);
      
      // Average should be well under target
      expect(stats.average).toBeLessThan(12);
      
      // P95 should be under target
      expect(stats.p95).toBeLessThan(16);
      
      // Performance should be consistent (low variance)
      const variance = stats.max - stats.min;
      expect(variance).toBeLessThan(10); // Less than 10ms variance
      
      console.log('10 Toggle Performance Stats:', {
        average: `${stats.average.toFixed(2)}ms`,
        median: `${stats.median.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
        min: `${stats.min.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`,
        variance: `${variance.toFixed(2)}ms`,
      });
    });

    it('should handle rapid successive toggles without performance degradation', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform rapid toggles (no delay)
      for (let i = 0; i < 5; i++) {
        benchmark.start();
        
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        benchmark.end();
      }
      
      const stats = benchmark.getStats();
      
      // Even rapid toggles should be performant
      expect(stats.max).toBeLessThan(20); // Slightly higher tolerance for rapid toggles
      expect(stats.average).toBeLessThan(15);
      
      console.log('Rapid Toggle Performance Stats:', {
        average: `${stats.average.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`,
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with complex DOM structure', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      // Verify complex DOM is rendered
      const stressTestElements = document.querySelectorAll('.card-theme');
      expect(stressTestElements.length).toBeGreaterThan(100); // Should have many elements

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform toggle with complex DOM
      benchmark.start();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const duration = benchmark.end();
      
      // Should still be performant with complex DOM
      expect(duration).toBeLessThan(20); // Slightly higher tolerance for complex DOM
      
      console.log(`Complex DOM toggle completed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain performance during CSS transitions', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Start a theme toggle
      benchmark.start();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const firstDuration = benchmark.end();
      
      // Immediately start another toggle (during potential transition)
      benchmark.start();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const secondDuration = benchmark.end();
      
      // Both toggles should be performant
      expect(firstDuration).toBeLessThan(16);
      expect(secondDuration).toBeLessThan(16);
      
      console.log(`Transition toggle durations: ${firstDuration.toFixed(2)}ms, ${secondDuration.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance', () => {
    it('should not cause memory leaks during repeated toggles', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Measure initial memory (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many toggles
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      // Measure final memory
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory usage should not grow significantly
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        // Should not increase memory by more than 50%
        expect(memoryIncreasePercent).toBeLessThan(50);
        
        console.log(`Memory usage: ${initialMemory} -> ${finalMemory} (${memoryIncreasePercent.toFixed(2)}% increase)`);
      }
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should accurately track performance metrics in theme store', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform several toggles
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Check that performance metrics are being tracked
      await waitFor(() => {
        const reportElement = screen.getByTestId('performance-report');
        const report = JSON.parse(reportElement.textContent || '{}');
        
        expect(report.totalToggles).toBe(5);
        expect(report.averageTime).toBeGreaterThan(0);
        expect(report.lastTime).toBeGreaterThan(0);
        expect(report.optimalPerformance).toBe(true); // Should be optimal
      });
      
      // Check individual metrics
      const lastToggleElement = screen.getByTestId('last-toggle-time');
      const averageToggleElement = screen.getByTestId('average-toggle-time');
      
      expect(lastToggleElement.textContent).not.toBe('N/Ams');
      expect(averageToggleElement.textContent).not.toBe('0.00ms');
    });

    it('should detect performance regressions', async () => {
      // Mock slow performance
      const originalNow = performance.now;
      let callCount = 0;
      
      performance.now = vi.fn(() => {
        callCount++;
        // Simulate slow performance (over 16ms)
        return callCount * 20; // 20ms increments
      });

      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform toggle with mocked slow performance
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      // Check that performance regression is detected
      await waitFor(() => {
        const reportElement = screen.getByTestId('performance-report');
        const report = JSON.parse(reportElement.textContent || '{}');
        
        expect(report.optimalPerformance).toBe(false); // Should detect regression
        expect(report.averageTime).toBeGreaterThan(16);
      });
      
      // Restore original performance.now
      performance.now = originalNow;
    });
  });

  describe('Performance Budgets', () => {
    it('should meet all performance budget targets', async () => {
      render(
        <ThemeProvider>
          <BenchmarkTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
      });

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform multiple toggles to get reliable metrics
      for (let i = 0; i < 10; i++) {
        benchmark.start();
        
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        benchmark.end();
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const stats = benchmark.getStats();
      
      // Performance budget targets
      const budgets = {
        averageToggleTime: 10,  // ms
        p95ToggleTime: 16,      // ms
        maxToggleTime: 20,      // ms
        consistencyVariance: 10, // ms
      };
      
      // Check all budget targets
      expect(stats.average).toBeLessThan(budgets.averageToggleTime);
      expect(stats.p95).toBeLessThan(budgets.p95ToggleTime);
      expect(stats.max).toBeLessThan(budgets.maxToggleTime);
      expect(stats.max - stats.min).toBeLessThan(budgets.consistencyVariance);
      
      console.log('Performance Budget Results:', {
        averageToggleTime: `${stats.average.toFixed(2)}ms (budget: ${budgets.averageToggleTime}ms)`,
        p95ToggleTime: `${stats.p95.toFixed(2)}ms (budget: ${budgets.p95ToggleTime}ms)`,
        maxToggleTime: `${stats.max.toFixed(2)}ms (budget: ${budgets.maxToggleTime}ms)`,
        consistencyVariance: `${(stats.max - stats.min).toFixed(2)}ms (budget: ${budgets.consistencyVariance}ms)`,
        allBudgetsMet: true,
      });
    });
  });
});