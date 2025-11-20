import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';

import PatientBilling from '../PatientBilling';
import { PatientAuthContext } from '../../../contexts/PatientAuthContext';

// Mock the hooks
jest.mock('../../../hooks/usePatientAuth');
jest.mock('../../../hooks/usePatientBilling', () => {
  return jest.fn(() => ({
    invoices: [
      {
        _id: 'inv_001',
        invoiceNumber: 'INV-2024-001',
        patientId: 'patient_123',
        workplaceId: 'workplace_456',
        items: [
          {
            description: 'Medication Therapy Review',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000,
            category: 'consultation',
          },
        ],
        subtotal: 15000,
        tax: 750,
        discount: 0,
        totalAmount: 15750,
        status: 'pending',
        dueDate: '2024-03-20',
        issuedDate: '2024-03-10',
        notes: 'Payment due within 10 days',
        createdAt: '2024-03-10T10:00:00.000Z',
        updatedAt: '2024-03-10T10:00:00.000Z',
      },
      {
        _id: 'inv_002',
        invoiceNumber: 'INV-2024-002',
        patientId: 'patient_123',
        workplaceId: 'workplace_456',
        items: [
          {
            description: 'Blood Pressure Monitoring',
            quantity: 1,
            unitPrice: 5000,
            totalPrice: 5000,
            category: 'service',
          },
        ],
        subtotal: 5000,
        tax: 250,
        discount: 500,
        totalAmount: 4750,
        status: 'paid',
        dueDate: '2024-02-25',
        issuedDate: '2024-02-15',
        paidDate: '2024-02-20',
        paymentMethod: 'card',
        createdAt: '2024-02-15T10:00:00.000Z',
        updatedAt: '2024-02-20T14:30:00.000Z',
      },
    ],
    paymentHistory: [
      {
        _id: 'pay_001',
        invoiceId: 'inv_002',
        transactionId: 'TXN_20240220_001',
        amount: 4750,
        paymentMethod: 'card',
        status: 'completed',
        gateway: 'paystack',
        reference: 'PSK_20240220_001',
        description: 'Payment for Invoice INV-2024-002',
        processedAt: '2024-02-20T14:30:00.000Z',
        createdAt: '2024-02-20T14:25:00.000Z',
        updatedAt: '2024-02-20T14:30:00.000Z',
      },
    ],
    billingStats: {
      totalOutstanding: 15750,
      totalPaid: 4750,
      pendingInvoices: 1,
      overdueInvoices: 0,
      lastPaymentDate: '2024-02-20',
      lastPaymentAmount: 4750,
    },
    loading: false,
    error: null,
    paymentLoading: false,
    paymentError: null,
    refreshBilling: jest.fn(),
    initiatePayment: jest.fn().mockResolvedValue({
      paymentUrl: 'https://checkout.paystack.com/abc123',
      reference: 'REF_123456',
    }),
    getInvoiceDetails: jest.fn().mockResolvedValue({
      _id: 'inv_001',
      invoiceNumber: 'INV-2024-001',
      items: [
        {
          description: 'Medication Therapy Review',
          quantity: 1,
          unitPrice: 15000,
          totalPrice: 15000,
          category: 'consultation',
        },
      ],
      totalAmount: 15750,
      status: 'pending',
    }),
    downloadInvoice: jest.fn(),
  }));
});

const theme = createTheme();

const createWrapper = (authValue: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <PatientAuthContext.Provider value={authValue}>
            {children}
          </PatientAuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('PatientBilling', () => {
  const mockUser = {
    _id: 'patient-123',
    patientId: 'patient-123',
    workplaceId: 'workplace-456',
    email: 'patient@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    refreshUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the billing page correctly', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Billing & Payments')).toBeInTheDocument();
    expect(screen.getByText('View your invoices, payment history, and manage payments')).toBeInTheDocument();
  });

  it('shows login warning when user is not authenticated', () => {
    const unauthenticatedContext = {
      ...mockAuthContextValue,
      user: null,
      isAuthenticated: false,
    };

    render(<PatientBilling />, {
      wrapper: createWrapper(unauthenticatedContext),
    });

    expect(screen.getByText('Please log in to view your billing information.')).toBeInTheDocument();
  });

  it('displays billing statistics correctly', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('₦15,750.00')).toBeInTheDocument(); // Outstanding
    expect(screen.getByText('₦4,750.00')).toBeInTheDocument(); // Total Paid
    expect(screen.getByText('1')).toBeInTheDocument(); // Pending invoices
    expect(screen.getByText('0')).toBeInTheDocument(); // Overdue invoices
  });

  it('displays invoices in the first tab', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('INV-2024-001')).toBeInTheDocument();
    expect(screen.getByText('INV-2024-002')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('handles tab navigation correctly', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const invoicesTab = screen.getByRole('tab', { name: /invoices/i });
    const paymentHistoryTab = screen.getByRole('tab', { name: /payment history/i });

    expect(invoicesTab).toHaveAttribute('aria-selected', 'true');
    expect(paymentHistoryTab).toHaveAttribute('aria-selected', 'false');

    // Click on Payment History tab
    fireEvent.click(paymentHistoryTab);

    expect(invoicesTab).toHaveAttribute('aria-selected', 'false');
    expect(paymentHistoryTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays payment history in the second tab', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Switch to Payment History tab
    const paymentHistoryTab = screen.getByRole('tab', { name: /payment history/i });
    fireEvent.click(paymentHistoryTab);

    expect(screen.getByText('PSK_20240220_001')).toBeInTheDocument();
    expect(screen.getByText('CARD')).toBeInTheDocument();
  });

  it('handles invoice view action', async () => {
    const mockGetInvoiceDetails = jest.fn().mockResolvedValue({
      _id: 'inv_001',
      invoiceNumber: 'INV-2024-001',
      items: [
        {
          description: 'Medication Therapy Review',
          quantity: 1,
          unitPrice: 15000,
          totalPrice: 15000,
          category: 'consultation',
        },
      ],
      totalAmount: 15750,
      status: 'pending',
    });

    // Mock the hook to return our mock function
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [
        {
          _id: 'inv_001',
          invoiceNumber: 'INV-2024-001',
          status: 'pending',
          totalAmount: 15750,
        },
      ],
      paymentHistory: [],
      billingStats: null,
      loading: false,
      error: null,
      getInvoiceDetails: mockGetInvoiceDetails,
      refreshBilling: jest.fn(),
      initiatePayment: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(mockGetInvoiceDetails).toHaveBeenCalledWith('inv_001');
    });
  });

  it('handles payment initiation', async () => {
    const mockInitiatePayment = jest.fn().mockResolvedValue({
      paymentUrl: 'https://checkout.paystack.com/abc123',
      reference: 'REF_123456',
    });

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    // Mock the hook to return our mock function
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [
        {
          _id: 'inv_001',
          invoiceNumber: 'INV-2024-001',
          status: 'pending',
          totalAmount: 15750,
        },
      ],
      paymentHistory: [],
      billingStats: null,
      loading: false,
      error: null,
      initiatePayment: mockInitiatePayment,
      refreshBilling: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    // Payment dialog should open
    expect(screen.getByText('Make Payment')).toBeInTheDocument();

    // Click proceed to payment
    const proceedButton = screen.getByRole('button', { name: /proceed to payment/i });
    fireEvent.click(proceedButton);

    await waitFor(() => {
      expect(mockInitiatePayment).toHaveBeenCalledWith({
        invoiceId: 'inv_001',
        paymentMethod: 'card',
        returnUrl: '',
      });
    });
  });

  it('handles invoice expansion', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const expandButton = screen.getAllByRole('button')[3]; // Assuming it's the expand button
    fireEvent.click(expandButton);

    // Should show expanded content
    expect(screen.getByText('Invoice Items')).toBeInTheDocument();
  });

  it('handles refresh button click', () => {
    const mockRefreshBilling = jest.fn();

    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [],
      paymentHistory: [],
      billingStats: null,
      loading: false,
      error: null,
      refreshBilling: mockRefreshBilling,
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    expect(mockRefreshBilling).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: null,
      paymentHistory: null,
      billingStats: null,
      loading: true,
      error: null,
      refreshBilling: jest.fn(),
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const mockRefreshBilling = jest.fn();

    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: null,
      paymentHistory: null,
      billingStats: null,
      loading: false,
      error: 'Failed to load billing data',
      refreshBilling: mockRefreshBilling,
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Failed to load billing information. Please try again.')).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockRefreshBilling).toHaveBeenCalled();
  });

  it('shows empty state for invoices', () => {
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [],
      paymentHistory: [],
      billingStats: null,
      loading: false,
      error: null,
      refreshBilling: jest.fn(),
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('No invoices found')).toBeInTheDocument();
    expect(screen.getByText("You don't have any invoices yet.")).toBeInTheDocument();
  });

  it('shows empty state for payment history', () => {
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [],
      paymentHistory: [],
      billingStats: null,
      loading: false,
      error: null,
      refreshBilling: jest.fn(),
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Switch to Payment History tab
    const paymentHistoryTab = screen.getByRole('tab', { name: /payment history/i });
    fireEvent.click(paymentHistoryTab);

    expect(screen.getByText('No payment history found')).toBeInTheDocument();
    expect(screen.getByText("You don't have any payment history yet.")).toBeInTheDocument();
  });

  it('handles payment method selection', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    // Payment dialog should open
    expect(screen.getByText('Make Payment')).toBeInTheDocument();

    // Select bank transfer
    const bankTransferRadio = screen.getByRole('radio', { name: /bank transfer/i });
    fireEvent.click(bankTransferRadio);

    expect(bankTransferRadio).toBeChecked();
  });

  it('handles dialog close actions', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);

    // Payment dialog should open
    expect(screen.getByText('Make Payment')).toBeInTheDocument();

    // Close dialog
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByText('Make Payment')).not.toBeInTheDocument();
  });

  it('formats currency correctly', () => {
    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Check if Nigerian Naira format is used
    expect(screen.getByText('₦15,750.00')).toBeInTheDocument();
    expect(screen.getByText('₦4,750.00')).toBeInTheDocument();
  });

  it('shows overdue alert when there are overdue invoices', () => {
    require('../../../hooks/usePatientBilling').mockReturnValue({
      invoices: [
        {
          _id: 'inv_001',
          invoiceNumber: 'INV-2024-001',
          status: 'overdue',
          totalAmount: 15750,
        },
      ],
      paymentHistory: [],
      billingStats: {
        totalOutstanding: 15750,
        totalPaid: 0,
        pendingInvoices: 0,
        overdueInvoices: 1,
      },
      loading: false,
      error: null,
      refreshBilling: jest.fn(),
      initiatePayment: jest.fn(),
      getInvoiceDetails: jest.fn(),
      downloadInvoice: jest.fn(),
    });

    render(<PatientBilling />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('You have 1 overdue invoice(s)')).toBeInTheDocument();
    expect(screen.getByText('Please settle your overdue payments to avoid service interruption.')).toBeInTheDocument();
  });
});