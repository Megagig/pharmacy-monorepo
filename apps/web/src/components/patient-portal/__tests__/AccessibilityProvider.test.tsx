import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccessibilityProvider, useAccessibility } from '../AccessibilityProvider';

// Test component that uses the accessibility context
const TestComponent: React.FC = () => {
  const {
    announceMessage,
    isKeyboardUser,
    highContrastMode,
    toggleHighContrast,
    fontSize,
    setFontSize,
    reduceMotion,
    setReduceMotion,
    focusElement,
    skipToContent,
  } = useAccessibility();

  return (
    <div>
      <div data-testid="keyboard-user">{isKeyboardUser.toString()}</div>
      <div data-testid="high-contrast">{highContrastMode.toString()}</div>
      <div data-testid="font-size">{fontSize}</div>
      <div data-testid="reduce-motion">{reduceMotion.toString()}</div>
      
      <button onClick={() => announceMessage('Test message')}>
        Announce Message
      </button>
      <button onClick={toggleHighContrast}>
        Toggle High Contrast
      </button>
      <button onClick={() => setFontSize('large')}>
        Set Large Font
      </button>
      <button onClick={() => setReduceMotion(true)}>
        Enable Reduce Motion
      </button>
      <button onClick={() => focusElement('test-element')}>
        Focus Element
      </button>
      <button onClick={skipToContent}>
        Skip to Content
      </button>
      
      <div id="test-element" tabIndex={-1}>Test Element</div>
      <main>Main Content</main>
    </div>
  );
};

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock matchMedia for prefers-reduced-motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('AccessibilityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.className = '';
    
    // Clear any existing announcer elements
    const existingAnnouncers = document.querySelectorAll('[aria-live]');
    existingAnnouncers.forEach(el => el.remove());
  });

  afterEach(() => {
    // Clean up any announcer elements
    const announcers = document.querySelectorAll('[aria-live]');
    announcers.forEach(el => el.remove());
  });

  it('provides accessibility context to children', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('keyboard-user')).toHaveTextContent('false');
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');
    expect(screen.getByTestId('reduce-motion')).toHaveTextContent('true'); // Based on mock
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAccessibility must be used within an AccessibilityProvider');
    
    consoleSpy.mockRestore();
  });

  it('creates screen reader announcer element', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const announcer = document.querySelector('[aria-live="polite"]');
    expect(announcer).toBeInTheDocument();
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
    expect(announcer).toHaveAttribute('aria-relevant', 'text');
  });

  it('announces messages to screen readers', async () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const announceButton = screen.getByText('Announce Message');
    fireEvent.click(announceButton);

    const announcer = document.querySelector('[aria-live]');
    expect(announcer).toHaveTextContent('Test message');

    // Message should be cleared after timeout
    await waitFor(() => {
      expect(announcer).toHaveTextContent('');
    }, { timeout: 1500 });
  });

  it('detects keyboard usage', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('keyboard-user')).toHaveTextContent('false');

    // Simulate Tab key press
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByTestId('keyboard-user')).toHaveTextContent('true');

    // Simulate mouse click
    fireEvent.mouseDown(document);
    expect(screen.getByTestId('keyboard-user')).toHaveTextContent('false');
  });

  it('toggles high contrast mode', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(document.body).not.toHaveClass('high-contrast-mode');

    const toggleButton = screen.getByText('Toggle High Contrast');
    fireEvent.click(toggleButton);

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
    expect(document.body).toHaveClass('high-contrast-mode');
  });

  it('changes font size', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');
    expect(document.body).toHaveClass('font-size-medium');

    const fontButton = screen.getByText('Set Large Font');
    fireEvent.click(fontButton);

    expect(screen.getByTestId('font-size')).toHaveTextContent('large');
    expect(document.body).toHaveClass('font-size-large');
    expect(document.body).not.toHaveClass('font-size-medium');
  });

  it('toggles reduce motion', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const motionButton = screen.getByText('Enable Reduce Motion');
    fireEvent.click(motionButton);

    expect(screen.getByTestId('reduce-motion')).toHaveTextContent('true');
    expect(document.body).toHaveClass('reduce-motion');
  });

  it('focuses elements by ID', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const testElement = document.getElementById('test-element');
    const focusButton = screen.getByText('Focus Element');
    
    fireEvent.click(focusButton);
    
    expect(testElement).toHaveFocus();
  });

  it('skips to main content', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const mainElement = document.querySelector('main');
    const skipButton = screen.getByText('Skip to Content');
    
    fireEvent.click(skipButton);
    
    expect(mainElement).toHaveFocus();
  });

  it('saves and loads preferences from localStorage', () => {
    const savedPreferences = {
      highContrastMode: true,
      fontSize: 'large',
      reduceMotion: false,
    };
    
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedPreferences));

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
    expect(screen.getByTestId('font-size')).toHaveTextContent('large');
    expect(screen.getByTestId('reduce-motion')).toHaveTextContent('false');
  });

  it('handles localStorage errors gracefully', () => {
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    // Should still render with default values
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');

    consoleSpy.mockRestore();
  });

  it('saves preferences when they change', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByText('Toggle High Contrast');
    fireEvent.click(toggleButton);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'patient-portal-accessibility',
      expect.stringContaining('"highContrastMode":true')
    );
  });

  it('respects system preference for reduced motion', () => {
    // Mock prefers-reduced-motion: reduce
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('reduce-motion')).toHaveTextContent('true');
  });

  it('cleans up announcer element on unmount', () => {
    const { unmount } = render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const announcer = document.querySelector('[aria-live]');
    expect(announcer).toBeInTheDocument();

    unmount();

    expect(document.querySelector('[aria-live]')).not.toBeInTheDocument();
  });
});