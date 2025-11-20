import { useState, useEffect, useCallback } from 'react';
import { usePatientAuth } from './usePatientAuth';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  patientId: string;
  workplaceId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: 'medication' | 'consultation' | 'service' | 'other';
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  issuedDate: string;
  paidDate?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentTransaction {
  _id: string;
  invoiceId: string;
  transactionId: string;
  amount: number;
  paymentMethod: 'card' | 'bank_transfer' | 'mobile_money' | 'cash';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  gateway: 'paystack' | 'flutterwave' | 'stripe' | 'manual';
  reference: string;
  description: string;
  processedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface BillingStats {
  totalOutstanding: number;
  totalPaid: number;
  pendingInvoices: number;
  overdueInvoices: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

interface PaymentInitiationData {
  invoiceId: string;
  paymentMethod: 'card' | 'bank_transfer' | 'mobile_money';
  returnUrl?: string;
}

interface UsePatientBillingReturn {
  invoices: Invoice[] | null;
  paymentHistory: PaymentTransaction[] | null;
  billingStats: BillingStats | null;
  loading: boolean;
  error: string | null;
  paymentLoading: boolean;
  paymentError: string | null;
  refreshBilling: () => Promise<void>;
  initiatePayment: (data: PaymentInitiationData) => Promise<{ paymentUrl?: string; reference: string }>;
  getInvoiceDetails: (invoiceId: string) => Promise<Invoice>;
  downloadInvoice: (invoiceId: string) => Promise<void>;
}

interface PatientBillingResponse {
  success: boolean;
  data?: {
    invoices: Invoice[];
    paymentHistory: PaymentTransaction[];
    stats: BillingStats;
  };
  message?: string;
  error?: {
    message: string;
  };
}

interface PaymentInitiationResponse {
  success: boolean;
  data?: {
    paymentUrl?: string;
    reference: string;
    transactionId: string;
  };
  message?: string;
  error?: {
    message: string;
  };
}

// Patient Billing API Service
class PatientBillingService {
  private static baseUrl = '/api/patient-portal';

  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('patient_auth_token');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  static async getBillingData(patientId: string): Promise<PatientBillingResponse> {
    // Mock implementation - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockInvoices: Invoice[] = [
      {
        _id: 'inv_001',
        invoiceNumber: 'INV-2024-001',
        patientId: patientId,
        workplaceId: 'workplace_456',
        items: [
          {
            description: 'Medication Therapy Review',
            quantity: 1,
            unitPrice: 15000,
            totalPrice: 15000,
            category: 'consultation',
          },
          {
            description: 'Metformin 500mg (90 tablets)',
            quantity: 1,
            unitPrice: 8500,
            totalPrice: 8500,
            category: 'medication',
          },
        ],
        subtotal: 23500,
        tax: 1175,
        discount: 0,
        totalAmount: 24675,
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
        patientId: patientId,
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
      {
        _id: 'inv_003',
        invoiceNumber: 'INV-2024-003',
        patientId: patientId,
        workplaceId: 'workplace_456',
        items: [
          {
            description: 'Lisinopril 10mg (30 tablets)',
            quantity: 1,
            unitPrice: 6000,
            totalPrice: 6000,
            category: 'medication',
          },
        ],
        subtotal: 6000,
        tax: 300,
        discount: 0,
        totalAmount: 6300,
        status: 'overdue',
        dueDate: '2024-01-30',
        issuedDate: '2024-01-20',
        notes: 'Overdue payment - please settle immediately',
        createdAt: '2024-01-20T10:00:00.000Z',
        updatedAt: '2024-01-20T10:00:00.000Z',
      },
    ];

    const mockPaymentHistory: PaymentTransaction[] = [
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
      {
        _id: 'pay_002',
        invoiceId: 'inv_004',
        transactionId: 'TXN_20240115_001',
        amount: 12000,
        paymentMethod: 'bank_transfer',
        status: 'completed',
        gateway: 'manual',
        reference: 'BT_20240115_001',
        description: 'Payment for Invoice INV-2024-004',
        processedAt: '2024-01-15T16:00:00.000Z',
        createdAt: '2024-01-15T15:45:00.000Z',
        updatedAt: '2024-01-15T16:00:00.000Z',
      },
    ];

    const mockStats: BillingStats = {
      totalOutstanding: 30975, // inv_001 + inv_003
      totalPaid: 16750, // inv_002 + previous payments
      pendingInvoices: 1,
      overdueInvoices: 1,
      lastPaymentDate: '2024-02-20',
      lastPaymentAmount: 4750,
    };

    return {
      success: true,
      data: {
        invoices: mockInvoices,
        paymentHistory: mockPaymentHistory,
        stats: mockStats,
      },
      message: 'Billing data retrieved successfully',
    };
  }

  static async initiatePayment(data: PaymentInitiationData): Promise<PaymentInitiationResponse> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate validation errors
    if (!data.invoiceId) {
      throw new Error('Invoice ID is required');
    }

    if (!data.paymentMethod) {
      throw new Error('Payment method is required');
    }

    // Mock successful payment initiation
    const mockResponse: PaymentInitiationResponse = {
      success: true,
      data: {
        paymentUrl: data.paymentMethod === 'card' ? 'https://checkout.paystack.com/abc123' : undefined,
        reference: `REF_${Date.now()}`,
        transactionId: `TXN_${Date.now()}`,
      },
      message: 'Payment initiated successfully',
    };

    return mockResponse;
  }

  static async getInvoiceDetails(invoiceId: string): Promise<Invoice> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock invoice details - in real implementation, fetch from API
    const mockInvoice: Invoice = {
      _id: invoiceId,
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
        {
          description: 'Metformin 500mg (90 tablets)',
          quantity: 1,
          unitPrice: 8500,
          totalPrice: 8500,
          category: 'medication',
        },
      ],
      subtotal: 23500,
      tax: 1175,
      discount: 0,
      totalAmount: 24675,
      status: 'pending',
      dueDate: '2024-03-20',
      issuedDate: '2024-03-10',
      notes: 'Payment due within 10 days',
      createdAt: '2024-03-10T10:00:00.000Z',
      updatedAt: '2024-03-10T10:00:00.000Z',
    };

    return mockInvoice;
  }

  static async downloadInvoice(invoiceId: string): Promise<Blob> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock PDF download - in real implementation, fetch PDF from API
    const mockPdfContent = 'Mock PDF content for invoice ' + invoiceId;
    return new Blob([mockPdfContent], { type: 'application/pdf' });
  }
}

export const usePatientBilling = (patientId?: string): UsePatientBillingReturn => {
  const { user, isAuthenticated } = usePatientAuth();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[] | null>(null);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Load billing data when user is authenticated
  const loadBillingData = useCallback(async () => {
    if (!isAuthenticated || !user || !patientId) {
      setInvoices(null);
      setPaymentHistory(null);
      setBillingStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await PatientBillingService.getBillingData(patientId);
      if (response.success && response.data) {
        setInvoices(response.data.invoices);
        setPaymentHistory(response.data.paymentHistory);
        setBillingStats(response.data.stats);
      } else {
        throw new Error(response.message || 'Failed to load billing data');
      }
    } catch (err: any) {
      console.error('Failed to load billing data:', err);
      setError(err.message || 'Failed to load billing data');
      setInvoices(null);
      setPaymentHistory(null);
      setBillingStats(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, patientId]);

  // Load billing data on mount and when dependencies change
  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Initiate payment function
  const initiatePayment = useCallback(async (data: PaymentInitiationData) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      const response = await PatientBillingService.initiatePayment(data);
      if (response.success && response.data) {
        return {
          paymentUrl: response.data.paymentUrl,
          reference: response.data.reference,
        };
      } else {
        throw new Error(response.message || 'Failed to initiate payment');
      }
    } catch (err: any) {
      console.error('Failed to initiate payment:', err);
      setPaymentError(err.message || 'Failed to initiate payment');
      throw err;
    } finally {
      setPaymentLoading(false);
    }
  }, [isAuthenticated, user]);

  // Get invoice details function
  const getInvoiceDetails = useCallback(async (invoiceId: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    try {
      return await PatientBillingService.getInvoiceDetails(invoiceId);
    } catch (err: any) {
      console.error('Failed to get invoice details:', err);
      throw err;
    }
  }, [isAuthenticated, user]);

  // Download invoice function
  const downloadInvoice = useCallback(async (invoiceId: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('User not authenticated');
    }

    try {
      const pdfBlob = await PatientBillingService.downloadInvoice(invoiceId);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download invoice:', err);
      throw err;
    }
  }, [isAuthenticated, user]);

  // Refresh billing data function
  const refreshBilling = useCallback(async () => {
    await loadBillingData();
  }, [loadBillingData]);

  return {
    invoices,
    paymentHistory,
    billingStats,
    loading,
    error,
    paymentLoading,
    paymentError,
    refreshBilling,
    initiatePayment,
    getInvoiceDetails,
    downloadInvoice,
  };
};

export default usePatientBilling;