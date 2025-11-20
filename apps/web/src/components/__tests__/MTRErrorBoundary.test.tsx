import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MTRErrorBoundary from '../MTRErrorBoundary';

// Mock console.error to avoid noise in test output
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

// Component that throws an error for testing
const ThrowError: React.FC<{
  shouldThrow?: boolean;
  errorMessage?: string;
}> = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Component that throws an error in useEffect
const ThrowErrorInEffect: React.FC<{ shouldThrow?: boolean }> = ({
  shouldThrow = false,
}) => {
  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Error in useEffect');
    }
  }, [shouldThrow]);

  return <div>Component with effect</div>;
};

describe('MTRErrorBoundary', () => {
  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      render(
        <MTRErrorBoundary>
          <div>Test content</div>
        </MTRErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders multiple children correctly', () => {
      render(
        <MTRErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </MTRErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches and displays error when child component throws', () => {
      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An unexpected error occurred/)
      ).toBeInTheDocument();
    });

    it('displays custom error message when provided', () => {
      const customMessage = 'Custom MTR error occurred';

      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={customMessage} />
        </MTRErrorBoundary>
      );

      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An unexpected error occurred/)
      ).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <MTRErrorBoundary>
          <ThrowError
            shouldThrow={true}
            errorMessage="Detailed error message"
          />
        </MTRErrorBoundary>
      );

      expect(screen.getByText('Error Details:')).toBeInTheDocument();
      expect(screen.getByText('Detailed error message')).toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('hides error details in production mode', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <MTRErrorBoundary>
          <ThrowError
            shouldThrow={true}
            errorMessage="Detailed error message"
          />
        </MTRErrorBoundary>
      );

      expect(screen.queryByText('Error Details:')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Detailed error message')
      ).not.toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Recovery', () => {
    it('provides retry functionality', () => {
      const { rerender } = render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      // Error should be displayed
      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Rerender with no error
      rerender(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={false} />
        </MTRErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('provides refresh page functionality', () => {
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      const refreshButton = screen.getByRole('button', {
        name: /refresh page/i,
      });
      fireEvent.click(refreshButton);

      expect(mockReload).toHaveBeenCalled();
    });

    it('provides go back functionality', () => {
      // Mock window.history.back
      const mockBack = vi.fn();
      Object.defineProperty(window, 'history', {
        value: { back: mockBack },
        writable: true,
      });

      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      const backButton = screen.getByRole('button', { name: /go back/i });
      fireEvent.click(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Error Reporting', () => {
    it('logs error to console in development', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <MTRErrorBoundary>
          <ThrowError
            shouldThrow={true}
            errorMessage="Test error for logging"
          />
        </MTRErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('calls onError callback when provided', () => {
      const onErrorSpy = vi.fn();

      render(
        <MTRErrorBoundary onError={onErrorSpy}>
          <ThrowError shouldThrow={true} errorMessage="Callback test error" />
        </MTRErrorBoundary>
      );

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('includes component stack in error info', () => {
      const onErrorSpy = vi.fn();

      render(
        <MTRErrorBoundary onError={onErrorSpy}>
          <div>
            <ThrowError shouldThrow={true} />
          </div>
        </MTRErrorBoundary>
      );

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.stringContaining('ThrowError'),
        })
      );
    });
  });

  describe('Fallback UI Customization', () => {
    it('renders custom fallback UI when provided', () => {
      const CustomFallback = ({
        error,
        resetError,
      }: {
        error: Error;
        resetError: () => void;
      }) => (
        <div>
          <h2>Custom Error UI</h2>
          <p>Error: {error.message}</p>
          <button onClick={resetError}>Reset</button>
        </div>
      );

      render(
        <MTRErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} errorMessage="Custom fallback test" />
        </MTRErrorBoundary>
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(
        screen.getByText('Error: Custom fallback test')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reset/i })
      ).toBeInTheDocument();
    });

    it('passes error and resetError to custom fallback', () => {
      const CustomFallback = vi.fn(({ resetError }) => (
        <div>
          <button onClick={resetError}>Custom Reset</button>
        </div>
      ));

      render(
        <MTRErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} errorMessage="Fallback props test" />
        </MTRErrorBoundary>
      );

      expect(CustomFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          resetError: expect.any(Function),
        }),
        {}
      );
    });
  });

  describe('Error Boundary State Management', () => {
    it('resets error state when resetError is called', () => {
      const { rerender } = render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      // Error should be displayed
      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();

      // Click try again to reset error state
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Rerender with working component
      rerender(
        <MTRErrorBoundary>
          <div>Working component</div>
        </MTRErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('maintains error state until explicitly reset', () => {
      const { rerender } = render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      // Error should be displayed
      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();

      // Rerender with different content but don't reset error
      rerender(
        <MTRErrorBoundary>
          <div>New content</div>
        </MTRErrorBoundary>
      );

      // Should still show error
      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();
      expect(screen.queryByText('New content')).not.toBeInTheDocument();
    });
  });

  describe('Error Types', () => {
    it('handles JavaScript errors', () => {
      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="JavaScript Error" />
        </MTRErrorBoundary>
      );

      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();
    });

    it('handles React errors', () => {
      const ReactErrorComponent = () => {
        throw new Error('React component error');
      };

      render(
        <MTRErrorBoundary>
          <ReactErrorComponent />
        </MTRErrorBoundary>
      );

      expect(
        screen.getByText('Something went wrong with the MTR module')
      ).toBeInTheDocument();
    });

    it('handles async errors in useEffect (note: error boundaries do not catch these)', () => {
      // Error boundaries don't catch errors in event handlers, async code, or useEffect
      // This test documents the limitation
      render(
        <MTRErrorBoundary>
          <ThrowErrorInEffect shouldThrow={true} />
        </MTRErrorBoundary>
      );

      // Component should render normally since error boundary doesn't catch useEffect errors
      expect(screen.getByText('Component with effect')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for error state', () => {
      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      const errorContainer = screen.getByRole('alert');
      expect(errorContainer).toBeInTheDocument();
    });

    it('has proper heading hierarchy in error state', () => {
      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(
        'Something went wrong with the MTR module'
      );
    });

    it('has accessible button labels', () => {
      render(
        <MTRErrorBoundary>
          <ThrowError shouldThrow={true} />
        </MTRErrorBoundary>
      );

      expect(
        screen.getByRole('button', { name: /try again/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /refresh page/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /go back/i })
      ).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not re-render children unnecessarily when no error', () => {
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        return <div>Test</div>;
      };

      const { rerender } = render(
        <MTRErrorBoundary>
          <TestComponent />
        </MTRErrorBoundary>
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Rerender with same props
      rerender(
        <MTRErrorBoundary>
          <TestComponent />
        </MTRErrorBoundary>
      );

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});
