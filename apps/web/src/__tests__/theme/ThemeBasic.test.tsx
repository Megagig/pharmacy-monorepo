import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThemeProvider from '../../components/providers/ThemeProvider';
import ThemeToggle from '../../components/common/ThemeToggle';

// Simple test component
const SimpleThemeTest: React.FC = () => {
  return (
    <div data-testid="theme-container">
      <ThemeToggle data-testid="theme-toggle" />
      <div className="bg-theme-primary text-theme-primary p-4">
        <h1>Theme Test</h1>
        <p>This content should change themes without flicker.</p>
      </div>
    </div>
  );
};

describe('Basic Theme Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-mode');
  });

  it('should render theme toggle component', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });
  });

  it('should apply theme class to document element', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(
        document.documentElement.classList.contains('light') ||
        document.documentElement.classList.contains('dark')
      ).toBe(true);
    });
  });

  it('should toggle theme when button is clicked', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    const initialTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    const toggleButton = screen.getByTestId('theme-toggle');
    
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      expect(newTheme).not.toBe(initialTheme);
    });
  });

  it('should set data-theme attribute', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      const dataTheme = document.documentElement.getAttribute('data-theme');
      expect(dataTheme).toBeTruthy();
      expect(['light', 'dark'].includes(dataTheme!)).toBe(true);
    });
  });

  it('should set CSS custom property', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      const themeMode = document.documentElement.style.getPropertyValue('--theme-mode');
      expect(['light', 'dark'].includes(themeMode)).toBe(true);
    });
  });

  it('should complete theme toggle quickly', async () => {
    render(
      <ThemeProvider>
        <SimpleThemeTest />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    const toggleButton = screen.getByTestId('theme-toggle');
    
    const startTime = performance.now();
    
    await act(async () => {
      fireEvent.click(toggleButton);
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete reasonably quickly (allowing for test environment overhead)
    expect(duration).toBeLessThan(100); // 100ms is generous for test environment
  });
});