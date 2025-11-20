import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BillingSubscriptions from '../BillingSubscriptions';

const theme = createTheme();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Mock the billing service
jest.mock('../../../services/saasService', () => ({
  getBillingSubscriptions: jest.fn(),
  createSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getSubscriptionAnalytics: jest.fn(),
  processPayment: jest.fn(),
}));

describe('BillingSubscriptions', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('should render the component', () => {
    renderWithProviders(<BillingSubscriptions />);
    
    expect(screen.getByText('Billing & Subscriptions')).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    renderWithProviders(<BillingSubscriptions />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display subscription overview cards', async () => {
    const mockGetSubscriptionAnalytics = require('../../../services/saasService').getSubscriptionAnalytics;
    mockGetSubscriptionAnalytics.mockResolvedValue({
      totalRevenue: 50000,
      activeSubscriptions: 150,
      churnRate: 5.2,
      mrr: 12000
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Active Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Churn Rate')).toBeInTheDocument();
      expect(screen.getByText('Monthly Recurring Revenue')).toBeInTheDocument();
    });
  });

  it('should display subscription table headers', () => {
    renderWithProviders(<BillingSubscriptions />);
    
    expect(screen.getByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Next Billing')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should handle search functionality', async () => {
    renderWithProviders(<BillingSubscriptions />);
    
    const searchInput = screen.getByPlaceholderText(/search subscriptions/i);
    fireEvent.change(searchInput, { target: { value: 'test tenant' } });
    
    expect(searchInput).toHaveValue('test tenant');
  });

  it('should handle status filter', async () => {
    renderWithProviders(<BillingSubscriptions />);
    
    const statusFilter = screen.getByLabelText(/status filter/i);
    fireEvent.mouseDown(statusFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Past Due')).toBeInTheDocument();
      expect(screen.getByText('Trialing')).toBeInTheDocument();
    });
  });

  it('should handle plan filter', async () => {
    renderWithProviders(<BillingSubscriptions />);
    
    const planFilter = screen.getByLabelText(/plan filter/i);
    fireEvent.mouseDown(planFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });

  it('should display subscription data correctly', async () => {
    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });
  });

  it('should handle subscription actions menu', async () => {
    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    // Click actions menu
    const actionsButton = screen.getByLabelText(/actions for test tenant/i);
    fireEvent.click(actionsButton);

    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Change Plan')).toBeInTheDocument();
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });
  });

  it('should handle subscription cancellation', async () => {
    const mockCancelSubscription = require('../../../services/saasService').cancelSubscription;
    mockCancelSubscription.mockResolvedValue({ success: true });

    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    // Click actions menu and cancel
    const actionsButton = screen.getByLabelText(/actions for test tenant/i);
    fireEvent.click(actionsButton);

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel Subscription');
      fireEvent.click(cancelButton);
    });

    // Confirm cancellation
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /cancel subscription/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCancelSubscription).toHaveBeenCalledWith('sub1');
    });
  });

  it('should display revenue analytics chart', async () => {
    const mockGetSubscriptionAnalytics = require('../../../services/saasService').getSubscriptionAnalytics;
    mockGetSubscriptionAnalytics.mockResolvedValue({
      totalRevenue: 50000,
      activeSubscriptions: 150,
      churnRate: 5.2,
      mrr: 12000,
      revenueHistory: [
        { month: '2024-01', revenue: 10000 },
        { month: '2024-02', revenue: 12000 },
        { month: '2024-03', revenue: 15000 }
      ]
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Revenue Analytics')).toBeInTheDocument();
    });
  });

  it('should handle plan change dialog', async () => {
    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    // Click actions menu and change plan
    const actionsButton = screen.getByLabelText(/actions for test tenant/i);
    fireEvent.click(actionsButton);

    await waitFor(() => {
      const changePlanButton = screen.getByText('Change Plan');
      fireEvent.click(changePlanButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Change Subscription Plan')).toBeInTheDocument();
      expect(screen.getByLabelText(/new plan/i)).toBeInTheDocument();
    });
  });

  it('should handle payment processing', async () => {
    const mockProcessPayment = require('../../../services/saasService').processPayment;
    mockProcessPayment.mockResolvedValue({ success: true, transactionId: 'txn123' });

    renderWithProviders(<BillingSubscriptions />);
    
    const processPaymentButton = screen.getByRole('button', { name: /process payment/i });
    fireEvent.click(processPaymentButton);

    await waitFor(() => {
      expect(screen.getByText('Process Manual Payment')).toBeInTheDocument();
    });

    // Fill payment form
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: '99.99' }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Manual payment for premium plan' }
    });

    // Submit payment
    const submitButton = screen.getByRole('button', { name: /process payment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockProcessPayment).toHaveBeenCalledWith({
        amount: 99.99,
        description: 'Manual payment for premium plan'
      });
    });
  });

  it('should display pagination controls', () => {
    renderWithProviders(<BillingSubscriptions />);
    
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();
  });

  it('should handle error states', async () => {
    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockRejectedValue(new Error('Failed to fetch subscriptions'));

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load subscriptions/i)).toBeInTheDocument();
    });
  });

  it('should display empty state when no subscriptions', async () => {
    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: [],
      pagination: { total: 0, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText(/no subscriptions found/i)).toBeInTheDocument();
    });
  });

  it('should format currency correctly', async () => {
    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });
  });

  it('should format dates correctly', async () => {
    const mockSubscriptions = [
      {
        id: 'sub1',
        tenantId: 'tenant1',
        tenantName: 'Test Tenant',
        plan: 'premium',
        status: 'active',
        amount: 99.99,
        currency: 'USD',
        nextBillingDate: '2024-02-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      }
    ];

    const mockGetBillingSubscriptions = require('../../../services/saasService').getBillingSubscriptions;
    mockGetBillingSubscriptions.mockResolvedValue({
      subscriptions: mockSubscriptions,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    renderWithProviders(<BillingSubscriptions />);
    
    await waitFor(() => {
      expect(screen.getByText(/Feb 1, 2024/)).toBeInTheDocument();
    });
  });
});