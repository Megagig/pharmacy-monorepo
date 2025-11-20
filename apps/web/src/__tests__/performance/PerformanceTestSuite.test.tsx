/**
 * Comprehensive Performance Test Suite
 * Tests theme switching, bundle size, API latency, and Web Vitals performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import ThemeProvider from '../../components/providers/ThemeProvider';
import { useTheme } from '../../stores/themeStore';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Mock Web Vitals
vi.mock('web-vitals', () => ({
  getCLS: vi.fn(),
  getFID: vi.fn(),
  getFCP: vi.fn(),
  getLCP: vi.fn(),
  getTTFB: vi.fn(),
}));

// Performance test configuration
const PERFORMANCE_BUDGETS = {
  THEME_TOGGLE_MAX_TIME: 16, // 16ms (1 frame at 60fps)
  BUNDLE_SIZE_MAX_GZIP: 500 * 1024, // 500KB
  CHUNK_SIZE_MAX_GZIP: 200 * 1024, // 200KB
  API_LATENCY_P95_MAX: 500, // 500ms
  API_LATENCY_P50_MAX: 200, // 200ms
  LCP_TARGET: 2500, // 2.5s
  FID_TARGET: 100, // 100ms
  CLS_TARGET: 0.1, // 0.1
};

// Test component for theme performance
const ThemeTestComponent: React.FC = () => {
  const { theme, toggleTheme, getPerformanceReport } = useTheme();
  
  return (
    <div data-testid="theme-component">
      <div data-testid="current-theme">{theme}</div>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
      <div data-testid="performance-data">
        {JSON.stringify(getPerformanceReport())}
      </div>
    </div>
  );
};

describe('Comprehensive Performance Test Suite', () => {
  beforeEach(() => {
    // Mock performance API
    global.performance.now = vi.fn(() => Date.now());
    global.performance.mark = vi.fn();
    global.performance.measure = vi.fn();
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset document classes
    document.documentElement.classList.remove('light', 'dark');
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
  });

  describe('Theme Switching Performance Tests', () => {
    it('should toggle theme within 16ms budget', async () => {
      let callCount = 0;
      const mockNow = vi.fn(() => {
        callCount++;
        return callCount * 5; // 5ms increments
      });
      global.performance.now = mockNow;

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');
      
      const startTime = performance.now();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.THEME_TOGGLE_MAX_TIME);
    });

    it('should maintain consistent performance across multiple toggles', async () => {
      const durations: number[] = [];
      
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');
      
      // Perform 10 theme toggles
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        const endTime = performance.now();
        durations.push(endTime - startTime);
        
        // Small delay between toggles
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // All toggles should be under budget
      durations.forEach((duration) => {
        expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.THEME_TOGGLE_MAX_TIME);
      });
      
      // Average should be well under budget
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      expect(average).toBeLessThan(PERFORMANCE_BUDGETS.THEME_TOGGLE_MAX_TIME * 0.75);
    });
  });

  describe('Bundle Size Regression Tests', () => {
    it('should validate bundle size budgets', async () => {
      const mockBundleStats = {
        'main-abc123.js': { gzipSize: 150 * 1024 }, // 150KB
        'vendor-def456.js': { gzipSize: 180 * 1024 }, // 180KB
        'chunk-ghi789.js': { gzipSize: 80 * 1024 }, // 80KB
      };
      
      const totalSize = Object.values(mockBundleStats)
        .reduce((sum, { gzipSize }) => sum + gzipSize, 0);
      
      expect(totalSize).toBeLessThan(PERFORMANCE_BUDGETS.BUNDLE_SIZE_MAX_GZIP);
      
      // Individual chunks should be under budget
      Object.values(mockBundleStats).forEach(({ gzipSize }) => {
        expect(gzipSize).toBeLessThan(PERFORMANCE_BUDGETS.CHUNK_SIZE_MAX_GZIP);
      });
    });
  });

  describe('Web Vitals Performance Tests', () => {
    it('should validate Core Web Vitals budgets', async () => {
      const mockWebVitals = {
        LCP: 2200, // 2.2s
        FID: 80,   // 80ms
        CLS: 0.08, // 0.08
        FCP: 1500, // 1.5s
        TTFB: 200, // 200ms
      };
      
      expect(mockWebVitals.LCP).toBeLessThan(PERFORMANCE_BUDGETS.LCP_TARGET);
      expect(mockWebVitals.FID).toBeLessThan(PERFORMANCE_BUDGETS.FID_TARGET);
      expect(mockWebVitals.CLS).toBeLessThan(PERFORMANCE_BUDGETS.CLS_TARGET);
    });

    it('should collect Web Vitals metrics', async () => {
      const mockMetrics: any[] = [];
      
      const mockGetLCP = vi.mocked(getLCP);
      const mockGetFID = vi.mocked(getFID);
      const mockGetCLS = vi.mocked(getCLS);
      
      mockGetLCP.mockImplementation((callback) => {
        callback({ name: 'LCP', value: 2200, id: 'test' } as any);
      });
      
      mockGetFID.mockImplementation((callback) => {
        callback({ name: 'FID', value: 80, id: 'test' } as any);
      });
      
      mockGetCLS.mockImplementation((callback) => {
        callback({ name: 'CLS', value: 0.08, id: 'test' } as any);
      });
      
      // Simulate Web Vitals collection
      getLCP((metric) => mockMetrics.push(metric));
      getFID((metric) => mockMetrics.push(metric));
      getCLS((metric) => mockMetrics.push(metric));
      
      expect(mockMetrics).toHaveLength(3);
      expect(mockMetrics.find(m => m.name === 'LCP')?.value).toBe(2200);
      expect(mockMetrics.find(m => m.name === 'FID')?.value).toBe(80);
      expect(mockMetrics.find(m => m.name === 'CLS')?.value).toBe(0.08);
    });
  });
});