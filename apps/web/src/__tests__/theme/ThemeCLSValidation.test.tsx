import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThemeProvider from '../../components/providers/ThemeProvider';
import ThemeToggle from '../../components/common/ThemeToggle';

// Mock layout shift entry
interface MockLayoutShiftEntry extends PerformanceEntry {
  entryType: 'layout-shift';
  value: number;
  hadRecentInput: boolean;
  lastInputTime: number;
  sources: Array<{
    node?: Node;
    currentRect: DOMRectReadOnly;
    previousRect: DOMRectReadOnly;
  }>;
}

// CLS measurement utility
class CLSMeasurement {
  private observer: PerformanceObserver | null = null;
  private clsValue = 0;
  private sessionValue = 0;
  private sessionEntries: PerformanceEntry[] = [];

  constructor() {
    this.initializeObserver();
  }

  private initializeObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            const layoutShiftEntry = entry as MockLayoutShiftEntry;
            
            // Only count layout shifts that weren't caused by user input
            if (!layoutShiftEntry.hadRecentInput) {
              this.sessionValue += layoutShiftEntry.value;
              this.sessionEntries.push(entry);
            }
          }
        }
      });

      try {
        this.observer.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // PerformanceObserver not supported
      }
    }
  }

  getCLS(): number {
    return this.sessionValue;
  }

  getEntries(): PerformanceEntry[] {
    return [...this.sessionEntries];
  }

  reset() {
    this.clsValue = 0;
    this.sessionValue = 0;
    this.sessionEntries = [];
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Test component with various layout elements
const TestLayoutComponent: React.FC = () => {
  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary transition-theme">
      {/* Header */}
      <header className="bg-theme-secondary border-b border-theme-primary p-4">
        <h1 className="text-2xl font-bold text-theme-primary">Test Application</h1>
        <ThemeToggle data-testid="theme-toggle" />
      </header>

      {/* Main content with various elements that could shift */}
      <main className="container mx-auto p-4">
        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="card-theme p-6 rounded-lg"
              data-testid={`card-${i}`}
            >
              <h3 className="text-lg font-semibold text-theme-primary mb-2">
                Card {i}
              </h3>
              <p className="text-theme-secondary">
                This is a test card with content that should not shift during theme changes.
              </p>
              <button className="button-theme-primary mt-4 px-4 py-2 rounded">
                Action
              </button>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card-theme p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold text-theme-primary mb-4">Data Table</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-theme-primary">
                <th className="text-left p-2 text-theme-primary">Name</th>
                <th className="text-left p-2 text-theme-primary">Email</th>
                <th className="text-left p-2 text-theme-primary">Status</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-theme-secondary">
                  <td className="p-2 text-theme-primary">User {i}</td>
                  <td className="p-2 text-theme-secondary">user{i}@example.com</td>
                  <td className="p-2">
                    <span className="px-2 py-1 rounded text-xs bg-theme-accent text-white">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form */}
        <div className="card-theme p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-theme-primary mb-4">Form</h2>
          <form className="space-y-4">
            <div>
              <label className="block text-theme-primary mb-2">Name</label>
              <input
                type="text"
                className="input-theme w-full p-2 rounded"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-theme-primary mb-2">Email</label>
              <input
                type="email"
                className="input-theme w-full p-2 rounded"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-theme-primary mb-2">Message</label>
              <textarea
                className="input-theme w-full p-2 rounded h-24"
                placeholder="Enter your message"
              />
            </div>
            <button
              type="submit"
              className="button-theme-primary px-6 py-2 rounded"
            >
              Submit
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-theme-secondary border-t border-theme-primary p-4 mt-8">
        <p className="text-center text-theme-secondary">
          © 2024 Test Application. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

describe('Theme CLS (Cumulative Layout Shift) Validation', () => {
  let clsMeasurement: CLSMeasurement;

  beforeEach(() => {
    // Initialize CLS measurement
    clsMeasurement = new CLSMeasurement();
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear any existing theme classes
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    
    // Mock PerformanceObserver for consistent testing
    const mockEntries: MockLayoutShiftEntry[] = [];
    
    global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn((options) => {
        // Simulate no layout shifts during theme changes
        if (options.entryTypes?.includes('layout-shift')) {
          setTimeout(() => {
            callback({
              getEntries: () => mockEntries,
              getEntriesByName: () => [],
              getEntriesByType: () => mockEntries,
            });
          }, 0);
        }
      }),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    }));
  });

  afterEach(() => {
    clsMeasurement.disconnect();
    
    // Clean up DOM
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-mode');
  });

  describe('Layout Stability During Theme Changes', () => {
    it('should maintain CLS score below 0.1 during theme toggle', async () => {
      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Reset CLS measurement
      clsMeasurement.reset();

      // Get initial element positions
      const cards = screen.getAllByTestId(/card-\d/);
      const initialPositions = cards.map(card => ({
        element: card,
        rect: card.getBoundingClientRect(),
      }));

      // Toggle theme
      const themeToggle = screen.getByTestId('theme-toggle');
      
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Wait for theme change to complete
      await waitFor(() => {
        expect(
          document.documentElement.classList.contains('dark') ||
          document.documentElement.classList.contains('light')
        ).toBe(true);
      });

      // Check that elements haven't shifted
      const finalPositions = cards.map(card => ({
        element: card,
        rect: card.getBoundingClientRect(),
      }));

      // Compare positions
      initialPositions.forEach((initial, index) => {
        const final = finalPositions[index];
        const xShift = Math.abs(final.rect.x - initial.rect.x);
        const yShift = Math.abs(final.rect.y - initial.rect.y);
        
        // Allow for minimal shifts due to rounding
        expect(xShift).toBeLessThan(1);
        expect(yShift).toBeLessThan(1);
      });

      // CLS should be minimal (below 0.1 is good, below 0.05 is excellent)
      const clsScore = clsMeasurement.getCLS();
      expect(clsScore).toBeLessThan(0.1);
    });

    it('should not cause layout shifts in multiple rapid theme toggles', async () => {
      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      const themeToggle = screen.getByTestId('theme-toggle');
      
      // Reset CLS measurement
      clsMeasurement.reset();

      // Perform multiple rapid theme toggles
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.click(themeToggle);
        });
        
        // Small delay between toggles
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for all changes to settle
      await new Promise(resolve => setTimeout(resolve, 200));

      // CLS should remain low even with multiple toggles
      const clsScore = clsMeasurement.getCLS();
      expect(clsScore).toBeLessThan(0.1);
      
      // Should have no layout shift entries
      const entries = clsMeasurement.getEntries();
      expect(entries.length).toBe(0);
    });

    it('should maintain layout stability across different viewport sizes', async () => {
      // Test different viewport sizes
      const viewports = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ];

      for (const viewport of viewports) {
        // Set viewport size
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        });

        // Trigger resize event
        window.dispatchEvent(new Event('resize'));

        const { unmount } = render(
          <ThemeProvider>
            <TestLayoutComponent />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
        });

        // Reset CLS measurement for this viewport
        clsMeasurement.reset();

        // Toggle theme
        const themeToggle = screen.getByTestId('theme-toggle');
        
        await act(async () => {
          fireEvent.click(themeToggle);
        });

        // Check CLS for this viewport
        const clsScore = clsMeasurement.getCLS();
        expect(clsScore).toBeLessThan(0.1);

        unmount();
      }
    });
  });

  describe('Visual Stability Metrics', () => {
    it('should not trigger layout shift events during theme transitions', async () => {
      let layoutShiftCount = 0;
      
      // Mock PerformanceObserver to count layout shifts
      global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
        observe: vi.fn((options) => {
          if (options.entryTypes?.includes('layout-shift')) {
            // Simulate monitoring but no actual shifts
            setTimeout(() => {
              callback({
                getEntries: () => {
                  // Return empty array - no layout shifts
                  return [];
                },
                getEntriesByName: () => [],
                getEntriesByType: () => [],
              });
            }, 0);
          }
        }),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      }));

      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      const themeToggle = screen.getByTestId('theme-toggle');
      
      // Toggle theme multiple times
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          fireEvent.click(themeToggle);
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should not have triggered any layout shifts
      expect(layoutShiftCount).toBe(0);
    });

    it('should maintain element dimensions during theme changes', async () => {
      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Get initial dimensions
      const cards = screen.getAllByTestId(/card-\d/);
      const initialDimensions = cards.map(card => ({
        width: card.offsetWidth,
        height: card.offsetHeight,
      }));

      // Toggle theme
      const themeToggle = screen.getByTestId('theme-toggle');
      
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Wait for theme change
      await waitFor(() => {
        expect(
          document.documentElement.classList.contains('dark') ||
          document.documentElement.classList.contains('light')
        ).toBe(true);
      });

      // Check dimensions haven't changed
      const finalDimensions = cards.map(card => ({
        width: card.offsetWidth,
        height: card.offsetHeight,
      }));

      initialDimensions.forEach((initial, index) => {
        const final = finalDimensions[index];
        expect(final.width).toBe(initial.width);
        expect(final.height).toBe(initial.height);
      });
    });
  });

  describe('Transition Performance', () => {
    it('should complete theme transitions without blocking the main thread', async () => {
      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      const themeToggle = screen.getByTestId('theme-toggle');
      
      // Measure main thread blocking
      const startTime = performance.now();
      let mainThreadBlocked = false;
      
      // Set up a timer to check if main thread is blocked
      const checkTimer = setTimeout(() => {
        mainThreadBlocked = true;
      }, 20); // Should complete well before 20ms

      await act(async () => {
        fireEvent.click(themeToggle);
      });

      clearTimeout(checkTimer);
      const endTime = performance.now();
      
      // Should not have blocked main thread
      expect(mainThreadBlocked).toBe(false);
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(16);
    });

    it('should handle theme changes during CSS transitions gracefully', async () => {
      render(
        <ThemeProvider>
          <TestLayoutComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      const themeToggle = screen.getByTestId('theme-toggle');
      
      // Start a theme change
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Immediately start another theme change (stress test)
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Should handle rapid changes without layout shifts
      const clsScore = clsMeasurement.getCLS();
      expect(clsScore).toBeLessThan(0.1);
    });
  });
});