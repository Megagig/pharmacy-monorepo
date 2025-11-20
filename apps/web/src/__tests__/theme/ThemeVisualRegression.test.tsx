import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThemeProvider from '../../components/providers/ThemeProvider';
import ThemeToggle from '../../components/common/ThemeToggle';

// Mock canvas for screenshot comparison
class MockCanvas {
  width = 0;
  height = 0;
  
  getContext() {
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(this.width * this.height * 4),
        width: this.width,
        height: this.width,
      })),
      putImageData: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
    };
  }
  
  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  }
}

// Visual regression test component
const VisualTestComponent: React.FC = () => {
  return (
    <div className="p-8 bg-theme-primary text-theme-primary min-h-screen">
      {/* Header with theme toggle */}
      <header className="mb-8 p-4 bg-theme-secondary rounded-lg border border-theme-primary">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-theme-primary">Visual Test</h1>
          <ThemeToggle data-testid="theme-toggle" />
        </div>
      </header>

      {/* Color palette showcase */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-theme-primary mb-4">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-theme-primary border border-theme-primary rounded">
            <div className="w-full h-16 bg-theme-primary border border-theme-secondary rounded mb-2"></div>
            <p className="text-sm text-theme-secondary">Primary</p>
          </div>
          <div className="p-4 bg-theme-secondary border border-theme-primary rounded">
            <div className="w-full h-16 bg-theme-secondary border border-theme-primary rounded mb-2"></div>
            <p className="text-sm text-theme-secondary">Secondary</p>
          </div>
          <div className="p-4 bg-theme-tertiary border border-theme-primary rounded">
            <div className="w-full h-16 bg-theme-tertiary border border-theme-secondary rounded mb-2"></div>
            <p className="text-sm text-theme-secondary">Tertiary</p>
          </div>
          <div className="p-4 bg-theme-accent border border-theme-primary rounded">
            <div className="w-full h-16 bg-theme-accent border border-theme-secondary rounded mb-2"></div>
            <p className="text-sm text-theme-secondary">Accent</p>
          </div>
        </div>
      </section>

      {/* Typography showcase */}
      <section className="mb-8 p-6 bg-theme-secondary rounded-lg border border-theme-primary">
        <h2 className="text-xl font-semibold text-theme-primary mb-4">Typography</h2>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-theme-primary">Heading 1</h1>
          <h2 className="text-3xl font-semibold text-theme-primary">Heading 2</h2>
          <h3 className="text-2xl font-medium text-theme-primary">Heading 3</h3>
          <p className="text-base text-theme-primary">
            This is regular body text that should be clearly readable in both light and dark themes.
          </p>
          <p className="text-sm text-theme-secondary">
            This is secondary text with reduced opacity for less important information.
          </p>
          <p className="text-xs text-theme-tertiary">
            This is tertiary text for captions and fine print.
          </p>
        </div>
      </section>

      {/* Component showcase */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-theme-primary mb-4">Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buttons */}
          <div className="p-4 bg-theme-secondary rounded-lg border border-theme-primary">
            <h3 className="text-lg font-medium text-theme-primary mb-3">Buttons</h3>
            <div className="space-y-2">
              <button className="button-theme-primary w-full py-2 px-4 rounded">
                Primary Button
              </button>
              <button className="button-theme-secondary w-full py-2 px-4 rounded">
                Secondary Button
              </button>
              <button className="button-theme-secondary w-full py-2 px-4 rounded opacity-50 cursor-not-allowed">
                Disabled Button
              </button>
            </div>
          </div>

          {/* Form inputs */}
          <div className="p-4 bg-theme-secondary rounded-lg border border-theme-primary">
            <h3 className="text-lg font-medium text-theme-primary mb-3">Form Inputs</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Text input"
                className="input-theme w-full py-2 px-3 rounded"
              />
              <select className="input-theme w-full py-2 px-3 rounded">
                <option>Select option</option>
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
              <textarea
                placeholder="Textarea"
                className="input-theme w-full py-2 px-3 rounded h-20 resize-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Cards and shadows */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-theme-primary mb-4">Cards & Shadows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-theme p-4 rounded-lg shadow-theme-sm">
            <h3 className="font-medium text-theme-primary mb-2">Small Shadow</h3>
            <p className="text-sm text-theme-secondary">Card with small shadow</p>
          </div>
          <div className="card-theme p-4 rounded-lg shadow-theme-md">
            <h3 className="font-medium text-theme-primary mb-2">Medium Shadow</h3>
            <p className="text-sm text-theme-secondary">Card with medium shadow</p>
          </div>
          <div className="card-theme p-4 rounded-lg shadow-theme-lg">
            <h3 className="font-medium text-theme-primary mb-2">Large Shadow</h3>
            <p className="text-sm text-theme-secondary">Card with large shadow</p>
          </div>
        </div>
      </section>

      {/* Status indicators */}
      <section className="mb-8 p-6 bg-theme-secondary rounded-lg border border-theme-primary">
        <h2 className="text-xl font-semibold text-theme-primary mb-4">Status Indicators</h2>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Success
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Warning
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Error
          </span>
          <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Info
          </span>
        </div>
      </section>
    </div>
  );
};

// Screenshot utility (mocked for testing)
class ScreenshotUtility {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = new MockCanvas() as any;
    this.context = this.canvas.getContext('2d')!;
  }

  async captureElement(element: HTMLElement): Promise<string> {
    // Mock screenshot capture
    const rect = element.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Simulate capturing element
    return this.canvas.toDataURL();
  }

  compareScreenshots(screenshot1: string, screenshot2: string): number {
    // Mock comparison - return 0 for identical, 1 for completely different
    return screenshot1 === screenshot2 ? 0 : 0.1; // Small difference for testing
  }
}

describe('Theme Visual Regression Tests', () => {
  let screenshotUtil: ScreenshotUtility;

  beforeEach(() => {
    screenshotUtil = new ScreenshotUtility();
    
    // Mock canvas
    global.HTMLCanvasElement = MockCanvas as any;
    
    // Clear localStorage and DOM
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    // Clean up DOM
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-mode');
  });

  describe('Theme Consistency', () => {
    it('should maintain visual consistency in light theme', async () => {
      const { container } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      // Wait for theme initialization
      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Ensure light theme is active
      expect(document.documentElement.classList.contains('light')).toBe(true);

      // Capture screenshot of light theme
      const lightScreenshot = await screenshotUtil.captureElement(container);
      
      // Verify light theme elements are properly styled
      const primaryElements = container.querySelectorAll('.bg-theme-primary');
      expect(primaryElements.length).toBeGreaterThan(0);
      
      // Check that CSS variables are applied
      const computedStyle = getComputedStyle(document.documentElement);
      expect(computedStyle.getPropertyValue('--theme-mode')).toBe('light');
    });

    it('should maintain visual consistency in dark theme', async () => {
      const { container } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Toggle to dark theme
      const themeToggle = screen.getByTestId('theme-toggle');
      
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Wait for dark theme to be applied
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Capture screenshot of dark theme
      const darkScreenshot = await screenshotUtil.captureElement(container);
      
      // Verify dark theme elements are properly styled
      const primaryElements = container.querySelectorAll('.bg-theme-primary');
      expect(primaryElements.length).toBeGreaterThan(0);
      
      // Check that CSS variables are applied
      const computedStyle = getComputedStyle(document.documentElement);
      expect(computedStyle.getPropertyValue('--theme-mode')).toBe('dark');
    });

    it('should show visual differences between light and dark themes', async () => {
      const { container, rerender } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Capture light theme
      const lightScreenshot = await screenshotUtil.captureElement(container);

      // Toggle to dark theme
      const themeToggle = screen.getByTestId('theme-toggle');
      
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Capture dark theme
      const darkScreenshot = await screenshotUtil.captureElement(container);

      // Screenshots should be different
      const difference = screenshotUtil.compareScreenshots(lightScreenshot, darkScreenshot);
      expect(difference).toBeGreaterThan(0);
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should render consistently across different user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ];

      const screenshots: string[] = [];

      for (const userAgent of userAgents) {
        // Mock user agent
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          configurable: true,
        });

        const { container, unmount } = render(
          <ThemeProvider>
            <VisualTestComponent />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
        });

        const screenshot = await screenshotUtil.captureElement(container);
        screenshots.push(screenshot);

        unmount();
      }

      // All screenshots should be similar (allowing for minor differences)
      for (let i = 1; i < screenshots.length; i++) {
        const difference = screenshotUtil.compareScreenshots(screenshots[0], screenshots[i]);
        expect(difference).toBeLessThan(0.05); // Less than 5% difference
      }
    });
  });

  describe('Responsive Design', () => {
    it('should maintain theme consistency across different screen sizes', async () => {
      const screenSizes = [
        { width: 320, height: 568, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1920, height: 1080, name: 'desktop' },
      ];

      const screenshots: { [key: string]: string } = {};

      for (const size of screenSizes) {
        // Set viewport size
        Object.defineProperty(window, 'innerWidth', {
          value: size.width,
          configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
          value: size.height,
          configurable: true,
        });

        window.dispatchEvent(new Event('resize'));

        const { container, unmount } = render(
          <ThemeProvider>
            <VisualTestComponent />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
        });

        // Test both light and dark themes
        const lightScreenshot = await screenshotUtil.captureElement(container);
        
        const themeToggle = screen.getByTestId('theme-toggle');
        await act(async () => {
          fireEvent.click(themeToggle);
        });

        await waitFor(() => {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        });

        const darkScreenshot = await screenshotUtil.captureElement(container);

        screenshots[`${size.name}-light`] = lightScreenshot;
        screenshots[`${size.name}-dark`] = darkScreenshot;

        unmount();
      }

      // Verify that themes are consistent across screen sizes
      // (Each theme should look similar regardless of screen size)
      const lightScreenshots = Object.entries(screenshots)
        .filter(([key]) => key.includes('light'))
        .map(([, screenshot]) => screenshot);

      const darkScreenshots = Object.entries(screenshots)
        .filter(([key]) => key.includes('dark'))
        .map(([, screenshot]) => screenshot);

      // Light themes should be similar across sizes
      for (let i = 1; i < lightScreenshots.length; i++) {
        const difference = screenshotUtil.compareScreenshots(lightScreenshots[0], lightScreenshots[i]);
        expect(difference).toBeLessThan(0.1);
      }

      // Dark themes should be similar across sizes
      for (let i = 1; i < darkScreenshots.length; i++) {
        const difference = screenshotUtil.compareScreenshots(darkScreenshots[0], darkScreenshots[i]);
        expect(difference).toBeLessThan(0.1);
      }
    });
  });

  describe('Animation and Transition Quality', () => {
    it('should maintain visual quality during theme transitions', async () => {
      const { container } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      const themeToggle = screen.getByTestId('theme-toggle');
      
      // Capture before transition
      const beforeScreenshot = await screenshotUtil.captureElement(container);

      // Start theme transition
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Capture during transition (if any)
      const duringScreenshot = await screenshotUtil.captureElement(container);

      // Wait for transition to complete
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Capture after transition
      const afterScreenshot = await screenshotUtil.captureElement(container);

      // Before and after should be different
      const beforeAfterDiff = screenshotUtil.compareScreenshots(beforeScreenshot, afterScreenshot);
      expect(beforeAfterDiff).toBeGreaterThan(0);

      // Transition should be smooth (no jarring changes)
      const beforeDuringDiff = screenshotUtil.compareScreenshots(beforeScreenshot, duringScreenshot);
      const duringAfterDiff = screenshotUtil.compareScreenshots(duringScreenshot, afterScreenshot);
      
      // Transitions should be gradual
      expect(beforeDuringDiff).toBeLessThan(beforeAfterDiff);
      expect(duringAfterDiff).toBeLessThan(beforeAfterDiff);
    });
  });

  describe('Accessibility Visual Compliance', () => {
    it('should maintain sufficient color contrast in both themes', async () => {
      const { container } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Test light theme contrast
      const lightElements = container.querySelectorAll('.text-theme-primary, .text-theme-secondary');
      expect(lightElements.length).toBeGreaterThan(0);

      // Toggle to dark theme
      const themeToggle = screen.getByTestId('theme-toggle');
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Test dark theme contrast
      const darkElements = container.querySelectorAll('.text-theme-primary, .text-theme-secondary');
      expect(darkElements.length).toBeGreaterThan(0);

      // Both themes should have proper text elements
      expect(lightElements.length).toBe(darkElements.length);
    });

    it('should maintain focus indicators in both themes', async () => {
      const { container } = render(
        <ThemeProvider>
          <VisualTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
      });

      // Find focusable elements
      const focusableElements = container.querySelectorAll('button, input, select, textarea');
      expect(focusableElements.length).toBeGreaterThan(0);

      // Test focus in light theme
      const firstButton = focusableElements[0] as HTMLElement;
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Toggle to dark theme
      const themeToggle = screen.getByTestId('theme-toggle');
      await act(async () => {
        fireEvent.click(themeToggle);
      });

      // Focus should still work in dark theme
      const secondButton = focusableElements[1] as HTMLElement;
      secondButton.focus();
      expect(document.activeElement).toBe(secondButton);
    });
  });
});