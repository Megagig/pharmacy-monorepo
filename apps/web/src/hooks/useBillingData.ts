import { useState, useEffect, useCallback } from 'react';
import { billingService } from '../services/billingService';

interface BillingAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByStatus: Record<string, number>;
  revenueByPlan: Array<{ planName: string; revenue: number; count: number }>;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  customerName: string;
  customerEmail: string;
}

interface Subscription {
  _id: string;
  status: string;
  planName: string;
  unitAmount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingInterval: string;
  customerName: string;
  customerEmail: string;
}

interface RevenueTrend {
  date: string;
  revenue: number;
  transactions: number;
}

interface UseBillingDataReturn {
  analytics: BillingAnalytics | null;
  invoices: Invoice[] | null;
  subscriptions: Subscription[] | null;
  revenueTrends: RevenueTrend[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  processRefund: (paymentReference: string, amount?: number, reason?: string) => Promise<void>;
}

export const useBillingData = (): UseBillingDataReturn => {
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingAnalytics = useCallback(async () => {
    try {
      const response = await billingService.getBillingAnalytics();
      if (response.success) {
        setAnalytics(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch billing analytics');
      }
    } catch (err) {
      console.error('Error fetching billing analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing analytics');
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await billingService.getInvoices(1, 50);
      if (response.success) {
        setInvoices(response.data.invoices);
      } else {
        throw new Error(response.message || 'Failed to fetch invoices');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await billingService.getSubscriptions(1, 50);
      if (response.success) {
        setSubscriptions(response.data.subscriptions);
      } else {
        throw new Error(response.message || 'Failed to fetch subscriptions');
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscriptions');
    }
  }, []);

  const fetchRevenueTrends = useCallback(async () => {
    try {
      const response = await billingService.getRevenueTrends('30d');
      if (response.success) {
        setRevenueTrends(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch revenue trends');
      }
    } catch (err) {
      console.error('Error fetching revenue trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue trends');
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchBillingAnalytics(),
        fetchInvoices(),
        fetchSubscriptions(),
        fetchRevenueTrends()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  }, [fetchBillingAnalytics, fetchInvoices, fetchSubscriptions, fetchRevenueTrends]);

  const processRefund = useCallback(async (
    paymentReference: string,
    amount?: number,
    reason?: string
  ) => {
    try {
      const response = await billingService.processRefund({
        paymentReference,
        amount,
        reason
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to process refund');
      }

      // Refresh data after successful refund
      await refreshData();
    } catch (err) {
      console.error('Error processing refund:', err);
      throw err;
    }
  }, [refreshData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    analytics,
    invoices,
    subscriptions,
    revenueTrends,
    loading,
    error,
    refreshData,
    processRefund
  };
};