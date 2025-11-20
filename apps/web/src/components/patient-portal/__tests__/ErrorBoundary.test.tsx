import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Custom error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    renderWithProviders(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error fallback when there is an error', () => {
    renderWithProviders(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong:')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('provides reset functionality', () => {
    const { rerender } = renderWithProviders(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Reset the error boundary
    const resetButton = screen.getByText('Try again');
    resetButton.click();

    // Re-render with no error
    rerender(
      <ThemeProvider theme={theme}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </ThemeProvider>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('handles async errors', async () => {
    const AsyncErrorComponent = () => {
      React.useEffect(() => {
        throw new Error('Async error');
      }, []);
      return <div>Async component</div>;
    };

    renderWithProviders(
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <AsyncErrorComponent />
      </ErrorBoundary>
    );

    // Note: Error boundaries don't catch async errors by default
    // This test demonstrates the limitation
    expect(screen.getByText('Async component')).toBeInTheDocument();
  });
});