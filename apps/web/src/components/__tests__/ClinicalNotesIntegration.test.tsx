import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import ClinicalNotes from '../../pages/ClinicalNotes';

// Mock the dashboard component to avoid complex dependencies
jest.mock('../../components/ClinicalNotesDashboard', () => {
  return function MockClinicalNotesDashboard() {
    return <div data-testid="clinical-notes-dashboard">Dashboard Mock</div>;
  };
});

const createTestWrapper = (initialEntries: string[] = ['/notes']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Clinical Notes Integration', () => {
  it('renders the main clinical notes page with proper structure', () => {
    const TestWrapper = createTestWrapper(['/notes']);

    render(
      <TestWrapper>
        <ClinicalNotes />
      </TestWrapper>
    );

    // Check that the page renders with expected elements
    expect(
      screen.getByRole('heading', { name: 'Clinical Notes' })
    ).toBeInTheDocument();
    expect(screen.getByText('New Clinical Note')).toBeInTheDocument();
    expect(screen.getByTestId('clinical-notes-dashboard')).toBeInTheDocument();
  });

  it('displays breadcrumbs correctly', () => {
    const TestWrapper = createTestWrapper(['/notes']);

    render(
      <TestWrapper>
        <ClinicalNotes />
      </TestWrapper>
    );

    // Check breadcrumb navigation
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
  });

  it('has proper responsive layout structure', () => {
    const TestWrapper = createTestWrapper(['/notes']);

    render(
      <TestWrapper>
        <ClinicalNotes />
      </TestWrapper>
    );

    // Check that main container and paper elements exist
    const container = screen.getByRole('main');
    expect(container).toBeInTheDocument();
  });
});
