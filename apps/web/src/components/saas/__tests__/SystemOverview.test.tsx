import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import SystemOverview from '../SystemOverview';
import * as saasQueries from '../../../queries/useSaasSettings';

// Mock the SaaS queries
jest.mock('../../../queries/useSaasSettings');

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockSystemMetrics = {
  totalUsers: 1247,
  activeUsers: 892,
  newUsersToday: 15,
  activeSubscriptions: 892,
  totalWorkspaces: 45,
  monthlyRevenue: 4250000,
  systemUptime: '99.8%',
  activeFeatureFlags: 12,
  pendingLicenses: 8,
  supportTickets: {
    open: 5,
    resolved: 23,
    critical: 1,
  },
};

const mockSystemHealth = {
  database: {
    status: 'healthy' as const,
    value: '45ms',
    message: 'Database is performing well',
  },
  api: {
    status: 'healthy' as const,
    value: '120ms',
    message: 'API response time is good',
  },
  memory: {
    status: 'warning' as const,
    value: 75,
    threshold: 80,
    message: 'Memory usage is approaching threshold',
  },
  cache: {
    status: 'healthy' as const,
    value: '2ms',
    message: 'Cache is performing optimally',
  },
};

const mockActivities = [
  {
    id: '1',
    type: 'user_registration' as const,
    title: 'New user registered',
    description: 'John Doe registered as a pharmacist',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    userId: 'user1',
  },
  {
    id: '2',
    type: 'feature_flag_change' as const,
    title: 'Feature flag updated',
    description: 'AI Diagnostics flag enabled for beta users',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    userId: 'admin1',
  },
  {
    id: '3',
    type: 'license_approval' as const,
    title: 'License approved',
    description: 'Pharmacist license approved for Jane Smith',
    timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    userId: 'admin1',
  },
];

describe('SystemOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render system metrics cards with correct data', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('1,247')).toBeInTheDocument();
      expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('892')).toBeInTheDocument();
      expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByText('₦4.3M')).toBeInTheDocument();
      expect(screen.getByText('System Uptime')).toBeInTheDocument();
      expect(screen.getByText('99.8%')).toBeInTheDocument();
    });
  });

  it('should display loading skeletons when data is loading', () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display error message when there is an error', () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch metrics'),
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    expect(screen.getByText('Error Loading System Overview')).toBeInTheDocument();
    expect(screen.getByText(/There was an error loading the system overview data/)).toBeInTheDocument();
  });

  it('should render system health status correctly', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('Database Performance')).toBeInTheDocument();
      expect(screen.getByText('API Response Time')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    });
  });

  it('should render recent activities with correct formatting', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activities')).toBeInTheDocument();
      expect(screen.getByText('New user registered')).toBeInTheDocument();
      expect(screen.getByText('Feature flag updated')).toBeInTheDocument();
      expect(screen.getByText('License approved')).toBeInTheDocument();
    });
  });

  it('should render quick actions section', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('License Reviews')).toBeInTheDocument();
    });
  });

  it('should display trend indicators correctly', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      // Check for trend indicators (percentage changes)
      expect(screen.getByText('+12%')).toBeInTheDocument();
      expect(screen.getByText('+8%')).toBeInTheDocument();
      expect(screen.getByText('+15%')).toBeInTheDocument();
    });
  });

  it('should handle empty activities gracefully', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('No recent activities')).toBeInTheDocument();
      expect(screen.getByText('System activities will appear here')).toBeInTheDocument();
    });
  });

  it('should format time ago correctly', async () => {
    (saasQueries.useSystemMetrics as jest.Mock).mockReturnValue({
      data: mockSystemMetrics,
      isLoading: false,
      error: null,
    });

    (saasQueries.useSystemHealth as jest.Mock).mockReturnValue({
      data: mockSystemHealth,
      isLoading: false,
      error: null,
    });

    (saasQueries.useRecentActivities as jest.Mock).mockReturnValue({
      data: mockActivities,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SystemOverview />);

    await waitFor(() => {
      expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
      expect(screen.getByText('15 minutes ago')).toBeInTheDocument();
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });
  });
});