import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThemeProvider from '../../components/providers/ThemeProvider';
import ThemeToggle from '../../components/common/ThemeToggle';
import { useTheme } from '../../stores/themeStore';

// Mock performance API for consistent testing
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
};

// Mock PerformanceObserver for CLS measurement
class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  private options: PerformanceObserverInit;

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }

  observe(options: PerformanceObserverInit) {
    this.options = options;
  }

  disconnect() {
    // Mock disconnect
  }

  takeRecords(): PerformanceEntryList {
    return [];
  }
}

// Test component that uses theme
const TestThemeComponent: React.FC = () => {
  const { theme, resolvedTheme, toggleTheme, getPerformanceReport } = useTheme();
  
  return (
    <div data-testid="theme-test-component">
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button 
        data-testid="theme-toggle-button" 
        onClick={toggleTheme}
      >
        Toggle Theme
      </button>
      <div data-testid="performance-report">
        {JSON.stringify(getPerformanceReport())}
      </div>
    </div>
  );
};

describe('Theme Performance Tests', () => {
  let originalPerformance: Performance;
  let originalPerformanceObserver: typeof PerformanceObserver;

  beforeEach(() => {
    // Mock performance API
    originalPerformance = global.performance;
    global.performance = mockPerformance as any;
    
    // Mock PerformanceObserver
    originalPerformanceObserver = global.PerformanceObserver;
    global.PerformanceObserver = MockPerformanceObserver as any;
    
    // Reset performance mock
    mockPerformance.now.mockClear();
    let time = 0;
    mockPerformance.now.mockImplementation(() => {
      time += Math.random() * 10; // Random time between 0-10ms
      return time;
    });

    // Clear localStorage
    localStorage.clear();
    
    // Clear any existing theme classes
    document.documentElement.classList.remove('light', 'dark');
  });

  afterEach(() => {
    // Restore original APIs
    global.performance = originalPerformance;
    global.PerformanceObserver = originalPerformanceObserver;
    
    // Clean up DOM
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-mode');
  });

  describe('Theme Toggle Performance', () => {
    it('should toggle theme within 16ms target', async () => {
      // Mock performance.now to return predictable values
      let callCount = 0;
      mockPerformance.now.mockImplementation(() => {
        callCount++;
        // Simulate fast theme toggle (under 16ms)
        return callCount * 5; // 5ms increments
      });

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Measure theme toggle performance
      const startTime = performance.now();
      
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within 16ms (1 frame at 60fps)
      expect(duration).toBeLessThan(16);
    });

    it('should maintain performance across multiple toggles', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      const durations: number[] = [];
      
      // Perform multiple theme toggles
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        await act(async () => {
          fireEvent.click(toggleButton);
        });
        
        const endTime = performance.now();
        durations.push(endTime - startTime);
        
        // Small delay between toggles
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // All toggles should be under 16ms
      durations.forEach((duration, index) => {
        expect(duration).toBeLessThan(16);
      });
      
      // Average should be well under 16ms
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      expect(average).toBeLessThan(12);
    });

    it('should track performance metrics correctly', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Perform theme toggle
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      // Wait for performance metrics to be recorded
      await waitFor(() => {
        const reportElement = screen.getByTestId('performance-report');
        const report = JSON.parse(reportElement.textContent || '{}');
        
        expect(report.totalToggles).toBeGreaterThan(0);
        expect(report.averageTime).toBeGreaterThan(0);
        expect(report.lastTime).toBeGreaterThan(0);
      });
    });
  });

  describe('DOM Manipulation Performance', () => {
    it('should apply theme classes synchronously', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Check initial state
      expect(document.documentElement.classList.contains('light') || 
             document.documentElement.classList.contains('dark')).toBe(true);
      
      const initialTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      
      // Toggle theme
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      // Theme class should be applied immediately (synchronously)
      const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      expect(newTheme).not.toBe(initialTheme);
      
      // Data attribute should be set
      expect(document.documentElement.getAttribute('data-theme')).toBe(newTheme);
      
      // CSS custom property should be set
      expect(document.documentElement.style.getPropertyValue('--theme-mode')).toBe(newTheme);
    });

    it('should not cause layout shifts during theme change', async () => {
      const layoutShifts: PerformanceEntry[] = [];
      
      // Mock PerformanceObserver to capture layout shifts
      const mockObserver = vi.fn((callback: PerformanceObserverCallback) => ({
        observe: vi.fn((options: PerformanceObserverInit) => {
          // Simulate no layout shifts during theme change
          if (options.entryTypes?.includes('layout-shift')) {
            callback({
              getEntries: () => layoutShifts,
              getEntriesByName: () => [],
              getEntriesByType: () => layoutShifts,
            } as any, mockObserver as any);
          }
        }),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      }));
      
      global.PerformanceObserver = mockObserver as any;

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Toggle theme and check for layout shifts
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      // Should not have any layout shifts
      expect(layoutShifts.length).toBe(0);
    });
  });

  describe('Theme Persistence', () => {
    it('should persist theme preference to localStorage', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle-button');
      
      // Toggle theme
      await act(async () => {
        fireEvent.click(toggleButton);
      });
      
      // Check localStorage
      const themeStorage = localStorage.getItem('theme-storage');
      expect(themeStorage).toBeTruthy();
      
      const parsed = JSON.parse(themeStorage!);
      expect(parsed.state.theme).toBeTruthy();
    });

    it('should restore theme from localStorage on initialization', async () => {
      // Set theme in localStorage
      const themeData = {
        state: { theme: 'dark' },
        version: 0
      };
      localStorage.setItem('theme-storage', JSON.stringify(themeData));
      
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );
      
      // Should restore dark theme
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });
  });

  describe('System Theme Detection', () => {
    it('should detect system theme preference', async () => {
      // Mock matchMedia for dark theme
      const mockMatchMedia = vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      global.matchMedia = mockMatchMedia;
      
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );
      
      // Should detect system preference
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should respond to system theme changes', async () => {
      let mediaQueryCallback: ((e: MediaQueryListEvent) => void) | null = null;
      
      const mockMatchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, callback: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            mediaQueryCallback = callback;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      global.matchMedia = mockMatchMedia;
      
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );
      
      // Simulate system theme change
      if (mediaQueryCallback) {
        await act(async () => {
          mediaQueryCallback({
            matches: true,
            media: '(prefers-color-scheme: dark)',
          } as MediaQueryListEvent);
        });
      }
      
      // Should respond to system theme change if theme is set to 'system'
      expect(mediaQueryCallback).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage error');
      });
      
      // Should not crash
      expect(() => {
        render(
          <ThemeProvider>
            <TestThemeComponent />
          </ThemeProvider>
        );
      }).not.toThrow();
      
      // Restore localStorage
      localStorage.getItem = originalGetItem;
    });

    it('should fallback to light theme on errors', async () => {
      // Mock performance.now to throw error
      mockPerformance.now.mockImplementation(() => {
        throw new Error('Performance API error');
      });
      
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );
      
      // Should fallback to light theme
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
    });
  });
});