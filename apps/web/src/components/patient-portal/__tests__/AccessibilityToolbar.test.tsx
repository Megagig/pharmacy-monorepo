import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import AccessibilityToolbar from '../AccessibilityToolbar';
import { AccessibilityProvider } from '../AccessibilityProvider';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <AccessibilityProvider>
        {component}
      </AccessibilityProvider>
    </ThemeProvider>
  );
};

describe('AccessibilityToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders accessibility toolbar', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('toolbar', { name: /accessibility options/i })).toBeInTheDocument();
  });

  it('shows font size controls', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('button', { name: /decrease font size/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase font size/i })).toBeInTheDocument();
    expect(screen.getByText(/font size/i)).toBeInTheDocument();
  });

  it('shows high contrast toggle', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('button', { name: /toggle high contrast/i })).toBeInTheDocument();
  });

  it('shows reduce motion toggle', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('button', { name: /toggle reduce motion/i })).toBeInTheDocument();
  });

  it('shows skip to content button', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('button', { name: /skip to main content/i })).toBeInTheDocument();
  });

  it('handles font size increase', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const increaseButton = screen.getByRole('button', { name: /increase font size/i });
    fireEvent.click(increaseButton);

    // Font size should change in the body class
    expect(document.body).toHaveClass('font-size-large');
  });

  it('handles font size decrease', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const decreaseButton = screen.getByRole('button', { name: /decrease font size/i });
    fireEvent.click(decreaseButton);

    // Font size should change in the body class
    expect(document.body).toHaveClass('font-size-small');
  });

  it('handles high contrast toggle', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const contrastButton = screen.getByRole('button', { name: /toggle high contrast/i });
    fireEvent.click(contrastButton);

    // High contrast should be applied to body
    expect(document.body).toHaveClass('high-contrast-mode');
  });

  it('handles reduce motion toggle', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const motionButton = screen.getByRole('button', { name: /toggle reduce motion/i });
    fireEvent.click(motionButton);

    // Reduce motion should be applied to body
    expect(document.body).toHaveClass('reduce-motion');
  });

  it('handles skip to content', () => {
    // Add a main element to the document
    const mainElement = document.createElement('main');
    mainElement.setAttribute('tabindex', '-1');
    document.body.appendChild(mainElement);

    renderWithProviders(<AccessibilityToolbar />);

    const skipButton = screen.getByRole('button', { name: /skip to main content/i });
    fireEvent.click(skipButton);

    // Main element should be focused
    expect(mainElement).toHaveFocus();

    // Clean up
    document.body.removeChild(mainElement);
  });

  it('shows current font size', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('disables font size buttons at limits', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const decreaseButton = screen.getByRole('button', { name: /decrease font size/i });
    const increaseButton = screen.getByRole('button', { name: /increase font size/i });

    // Click decrease to minimum
    fireEvent.click(decreaseButton);
    expect(decreaseButton).toBeDisabled();

    // Click increase to maximum
    fireEvent.click(increaseButton);
    fireEvent.click(increaseButton);
    fireEvent.click(increaseButton);
    expect(increaseButton).toBeDisabled();
  });

  it('provides keyboard navigation', () => {
    renderWithProviders(<AccessibilityToolbar />);

    const toolbar = screen.getByRole('toolbar');
    const buttons = screen.getAllByRole('button');

    // All buttons should be focusable
    buttons.forEach(button => {
      expect(button).toHaveAttribute('tabindex', '0');
    });
  });

  it('provides proper ARIA labels', () => {
    renderWithProviders(<AccessibilityToolbar />);

    expect(screen.getByRole('button', { name: /decrease font size/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: /increase font size/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: /toggle high contrast/i })).toHaveAttribute('aria-label');
  });

  it('shows tooltips on hover', async () => {
    renderWithProviders(<AccessibilityToolbar />);

    const contrastButton = screen.getByRole('button', { name: /toggle high contrast/i });
    fireEvent.mouseEnter(contrastButton);

    // Tooltip should appear (implementation depends on tooltip library)
    expect(contrastButton).toHaveAttribute('title');
  });

  it('handles collapsed state on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width:600px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderWithProviders(<AccessibilityToolbar />);

    // Should show expand button on mobile
    expect(screen.getByRole('button', { name: /accessibility options/i })).toBeInTheDocument();
  });
});