import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyWrapper } from '../components/LazyWrapper';
import { LazyModernDashboard } from '../components/LazyComponents';

// Mock the heavy components
vi.mock('../pages/ModernDashboardPage', () => ({
  default: () => <div data-testid="modern-dashboard">Modern Dashboard Loaded</div>
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Lazy Loading Implementation', () => {
  it('should show loading fallback initially', async () => {
    const LoadingFallback = () => <div data-testid="loading">Loading...</div>;
    
    render(
      <TestWrapper>
        <LazyWrapper fallback={LoadingFallback}>
          <LazyModernDashboard />
        </LazyWrapper>
      </TestWrapper>
    );

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should load the component after lazy loading', async () => {
    const LoadingFallback = () => <div data-testid="loading">Loading...</div>;
    
    render(
      <TestWrapper>
        <LazyWrapper fallback={LoadingFallback}>
          <LazyModernDashboard />
        </LazyWrapper>
      </TestWrapper>
    );

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByTestId('modern-dashboard')).toBeInTheDocument();
    });

    // Loading should be gone
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('should handle lazy loading errors gracefully', async () => {
    // Mock a component that throws an error
    const FailingComponent = () => {
      throw new Error('Component failed to load');
    };

    const ErrorFallback = ({ error }: { error: Error }) => (
      <div data-testid="error">Error: {error.message}</div>
    );

    render(
      <TestWrapper>
        <LazyWrapper errorFallback={ErrorFallback}>
          <FailingComponent />
        </LazyWrapper>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });
});