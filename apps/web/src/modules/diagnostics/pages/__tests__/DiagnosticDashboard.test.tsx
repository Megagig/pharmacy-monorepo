import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import DiagnosticDashboard from '../DiagnosticDashboard';
import * as diagnosticHooks from '../../hooks/useDiagnostics';
import * as stores from '../../../../stores';

// Mock the hooks
vi.mock('../../hooks/useDiagnostics');
vi.mock('../../../../stores');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

// Mock components
vi.mock('../../../components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../../components/common/NotificationSystem', () => ({
  NotificationSystem: () => <div data-testid="notification-system" />,
}));

const theme = createTheme();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const mockDiagnosticRequest = {
  _id: 'req-123',
  patientId: 'patient-123',
  pharmacistId: 'pharmacist-123',
  workplaceId: 'workplace-123',
  inputSnapshot: {
    symptoms: {
      subjective: ['headache', 'nausea'],
      objective: ['fever'],
      duration: '2 days',
      severity: 'moderate' as const,
      onset: 'acute' as const,
    },
  },
  consentObtained: true,
  consentTimestamp: '2024-01-15T10:00:00Z',
  promptVersion: '1.0',
  status: 'completed' as const,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
};

const mockDiagnosticResult = {
  _id: 'result-123',
  requestId: 'req-123',
  diagnoses: [
    {
      condition: 'Migraine',
      probability: 0.85,
      reasoning: 'Based on symptoms and presentation',
      severity: 'medium' as const,
      icdCode: 'G43.9',
    },
  ],
  suggestedTests: [],
  medicationSuggestions: [],
  redFlags: [],
  aiMetadata: {
    modelId: 'deepseek-v3.1',
    modelVersion: '1.0',
    confidenceScore: 0.85,
    processingTime: 15000,
    tokenUsage: {
      promptTokens: 500,
      completionTokens: 300,
      totalTokens: 800,
    },
    requestId: 'ai-req-123',
  },
  disclaimer: 'AI analysis requires pharmacist review',
  createdAt: '2024-01-15T10:30:00Z',
};

const mockAnalytics = {
  totalRequests: 25,
  completedRequests: 20,
  averageProcessingTime: 18000,
  averageConfidenceScore: 0.82,
  topDiagnoses: [
    {
      condition: 'Migraine',
      count: 5,
      averageConfidence: 0.85,
    },
  ],
  pharmacistReviewStats: {
    approvedCount: 15,
    modifiedCount: 3,
    rejectedCount: 2,
    averageReviewTime: 300,
  },
};

const mockPatients = [
  {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    phoneNumber: '555-0123',
  },
];

describe('DiagnosticDashboard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store hooks
    vi.mocked(stores.usePatients).mockReturnValue({
      patients: mockPatients,
      loading: false,
      error: null,
      selectedPatient: null,
      fetchPatients: vi.fn(),
      selectPatient: vi.fn(),
    } as any);

    // Mock diagnostic hooks
    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: {
        success: true,
        data: {
          results: [mockDiagnosticRequest],
        },
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(diagnosticHooks.useDiagnosticAnalytics).mockReturnValue({
      data: {
        success: true,
        data: mockAnalytics,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // Mock diagnostic store
    const mockStore = {
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
      setFilters: vi.fn(),
      clearFilters: vi.fn(),
      selectedRequest: null,
      selectRequest: vi.fn(),
    };

    // Mock the store import
    vi.doMock('../../store/diagnosticStore', () => ({
      useDiagnosticStore: () => mockStore,
    }));

    // Mock react-router-dom
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({}),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard with correct title and description', async () => {
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Diagnostic Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('AI-powered diagnostic analysis and case management')
    ).toBeInTheDocument();
  });

  it('displays quick stats cards with analytics data', async () => {
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Total Cases')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Completed Today')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Avg Confidence')).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
    });
  });

  it('displays recent cases with patient information', async () => {
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Recent Cases')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('headache, nausea')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    const mockSetFilters = vi.fn();

    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: {
        success: true,
        data: { results: [mockDiagnosticRequest] },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // Mock the store to return our mock function
    vi.doMock('../../store/diagnosticStore', () => ({
      useDiagnosticStore: () => ({
        filters: { search: '' },
        setFilters: mockSetFilters,
        clearFilters: vi.fn(),
        selectedRequest: null,
        selectRequest: vi.fn(),
      }),
    }));

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText('Search cases...');
    await user.type(searchInput, 'headache');

    await waitFor(() => {
      expect(mockSetFilters).toHaveBeenCalledWith({
        search: 'headache',
        page: 1,
      });
    });
  });

  it('navigates to new case page when New Case button is clicked', async () => {
    const user = userEvent.setup();
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    const newCaseButton = screen.getByRole('button', { name: /new case/i });
    await user.click(newCaseButton);

    expect(mockNavigate).toHaveBeenCalledWith('/diagnostics/case-intake');
  });

  it('handles case card actions', async () => {
    const user = userEvent.setup();
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByRole('button', {
      name: /view details/i,
    });
    await user.click(viewDetailsButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/diagnostics/case/${mockDiagnosticRequest._id}`
    );
  });

  it('displays quick actions sidebar', async () => {
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new diagnostic case/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /lab orders/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view analytics/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /referrals/i })
    ).toBeInTheDocument();
  });

  it('displays notifications for pending cases', async () => {
    const pendingRequest = {
      ...mockDiagnosticRequest,
      _id: 'pending-123',
      status: 'pending' as const,
    };

    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: {
        success: true,
        data: { results: [pendingRequest] },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText(/case pending/i)).toBeInTheDocument();
    });
  });

  it('handles refresh functionality', async () => {
    const user = userEvent.setup();
    const mockRefetchHistory = vi.fn();
    const mockRefetchAnalytics = vi.fn();

    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: { success: true, data: { results: [] } },
      isLoading: false,
      error: null,
      refetch: mockRefetchHistory,
    } as any);

    vi.mocked(diagnosticHooks.useDiagnosticAnalytics).mockReturnValue({
      data: { success: true, data: mockAnalytics },
      isLoading: false,
      error: null,
      refetch: mockRefetchAnalytics,
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockRefetchHistory).toHaveBeenCalled();
      expect(mockRefetchAnalytics).toHaveBeenCalled();
    });
  });

  it('displays loading state correctly', async () => {
    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(diagnosticHooks.useDiagnosticAnalytics).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    // Should show skeleton loaders
    expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);
  });

  it('displays error state when API calls fail', async () => {
    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
      refetch: vi.fn(),
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    expect(
      screen.getByText(/failed to load dashboard data/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('displays empty state when no cases exist', async () => {
    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: {
        success: true,
        data: { results: [] },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No cases yet')).toBeInTheDocument();
      expect(
        screen.getByText('Start your first diagnostic case to see it here')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create first case/i })
      ).toBeInTheDocument();
    });
  });

  it('handles filter menu interactions', async () => {
    const user = userEvent.setup();
    const mockSetFilters = vi.fn();
    const mockClearFilters = vi.fn();

    vi.doMock('../../store/diagnosticStore', () => ({
      useDiagnosticStore: () => ({
        filters: { search: '' },
        setFilters: mockSetFilters,
        clearFilters: mockClearFilters,
        selectedRequest: null,
        selectRequest: vi.fn(),
      }),
    }));

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    const filtersButton = screen.getByRole('button', { name: /filters/i });
    await user.click(filtersButton);

    const pendingFilter = screen.getByRole('menuitem', {
      name: /pending cases/i,
    });
    await user.click(pendingFilter);

    expect(mockSetFilters).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('shows floating action button on mobile', async () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    const fab = screen.getByRole('button', { name: /new case/i });
    expect(fab).toBeInTheDocument();
  });

  it('handles case menu actions', async () => {
    const user = userEvent.setup();
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the menu button
    const menuButton = screen.getByRole('button', { name: /more/i });
    await user.click(menuButton);

    // Check menu items
    expect(
      screen.getByRole('menuitem', { name: /view full details/i })
    ).toBeInTheDocument();
  });

  it('polls for updates when there are pending requests', async () => {
    const mockRefetch = vi.fn();
    const pendingRequest = {
      ...mockDiagnosticRequest,
      status: 'processing' as const,
    };

    vi.mocked(diagnosticHooks.useDiagnosticHistory).mockReturnValue({
      data: {
        success: true,
        data: { results: [pendingRequest] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    // Wait for polling to start
    await waitFor(
      () => {
        expect(mockRefetch).toHaveBeenCalled();
      },
      { timeout: 15000 }
    );
  });

  it('displays confidence indicators correctly', async () => {
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('82%')).toBeInTheDocument(); // Average confidence from analytics
    });
  });

  it('handles navigation to different sections', async () => {
    const user = userEvent.setup();
    render(<DiagnosticDashboard />, { wrapper: createWrapper() });

    // Test navigation to lab orders
    const labOrdersButton = screen.getByRole('button', { name: /lab orders/i });
    await user.click(labOrdersButton);
    expect(mockNavigate).toHaveBeenCalledWith('/diagnostics/lab-orders');

    // Test navigation to analytics
    const analyticsButton = screen.getByRole('button', {
      name: /view analytics/i,
    });
    await user.click(analyticsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/diagnostics/analytics');

    // Test navigation to referrals
    const referralsButton = screen.getByRole('button', { name: /referrals/i });
    await user.click(referralsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/diagnostics/referrals');
  });
});
