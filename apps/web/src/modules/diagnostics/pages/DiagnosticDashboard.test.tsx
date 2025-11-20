import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import DiagnosticDashboard from './DiagnosticDashboard';

// Mock the hooks
jest.mock('../hooks/useDiagnostics', () => ({
  useDiagnosticHistory: () => ({
    data: { data: { results: [] } },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useDiagnosticAnalytics: () => ({
    data: { data: {} },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../store/diagnosticStore', () => ({
  useDiagnosticStore: () => ({
    filters: {
      search: '',
      patientId: '',
      status: undefined,
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    setFilters: jest.fn(),
    clearFilters: jest.fn(),
    selectRequest: jest.fn(),
  }),
}));

jest.mock('../../../stores', () => ({
  usePatients: () => ({
    patients: [],
  }),
}));

jest.mock('../middlewares/diagnosticFeatureGuard', () => {
  return function DiagnosticFeatureGuard({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <>{children}</>;
  };
});

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DiagnosticDashboard', () => {
  it('renders without infinite loop', () => {
    render(
      <TestWrapper>
        <DiagnosticDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Diagnostic Dashboard')).toBeInTheDocument();
  });
});
