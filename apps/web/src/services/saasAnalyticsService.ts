import { api } from '../lib/api';

/**
 * SaaS Analytics Service
 * Handles all SaaS analytics and reporting API calls
 */

// Types
export interface SubscriptionAnalytics {
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    revenue: {
        total: number;
        monthly: number;
        annual: number;
    };
    growth: {
        subscriptions: number;
        revenue: number;
    };
    byPlan: Array<{
        planName: string;
        count: number;
        revenue: number;
    }>;
}

export interface PharmacyUsageReport {
    pharmacies: Array<{
        id: string;
        name: string;
        subscriptionPlan: string;
        metrics: {
            prescriptions: number;
            diagnostics: number;
            patients: number;
            interventions: number;
        };
        lastActivity: Date;
    }>;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ClinicalOutcomesReport {
    summary: {
        totalInterventions: number;
        resolvedInterventions: number;
        averageResolutionTime: number;
        patientOutcomes: {
            improved: number;
            stable: number;
            declined: number;
        };
    };
    byType: Array<{
        type: string;
        count: number;
        successRate: number;
    }>;
    trends: Array<{
        date: string;
        interventions: number;
        resolved: number;
    }>;
}

export interface ReportExportRequest {
    format: 'pdf' | 'csv' | 'excel';
    reportType: 'subscription' | 'pharmacy' | 'clinical' | 'financial';
    dateRange: {
        start: string;
        end: string;
    };
    includeCharts?: boolean;
    filters?: Record<string, any>;
}

export interface ReportSchedule {
    reportType: 'subscription' | 'pharmacy' | 'clinical' | 'financial';
    format: 'pdf' | 'csv' | 'excel';
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    filters?: Record<string, any>;
    includeCharts?: boolean;
}

class SaaSAnalyticsService {
    private baseUrl = '/admin/saas/analytics';

    /**
     * Get subscription analytics
     */
    async getSubscriptionAnalytics(params?: {
        timeRange?: '7d' | '30d' | '90d' | '1y' | 'custom';
        startDate?: string;
        endDate?: string;
    }): Promise<SubscriptionAnalytics> {
        const response = await api.get(`${this.baseUrl}/subscriptions`, { params });
        return response.data;
    }

    /**
     * Get pharmacy usage reports
     */
    async getPharmacyUsageReports(params?: {
        timeRange?: '7d' | '30d' | '90d' | '1y' | 'custom';
        pharmacyId?: string;
        subscriptionPlan?: string;
        sortBy?: 'name' | 'prescriptions' | 'diagnostics' | 'patients' | 'interventions' | 'lastActivity';
        sortOrder?: 'asc' | 'desc';
        page?: number;
        limit?: number;
    }): Promise<PharmacyUsageReport> {
        const response = await api.get(`${this.baseUrl}/pharmacy-usage`, { params });
        return response.data;
    }

    /**
     * Get clinical outcomes report
     */
    async getClinicalOutcomesReport(params?: {
        timeRange?: '7d' | '30d' | '90d' | '1y' | 'custom';
        pharmacyId?: string;
        interventionType?: string;
        includeDetails?: boolean;
    }): Promise<ClinicalOutcomesReport> {
        const response = await api.get(`${this.baseUrl}/clinical-outcomes`, { params });
        return response.data;
    }

    /**
     * Export analytics report
     */
    async exportReport(data: ReportExportRequest): Promise<Blob> {
        const response = await api.post(`${this.baseUrl}/export`, data, {
            responseType: 'blob',
        });
        return response.data;
    }

    /**
     * Schedule report delivery
     */
    async scheduleReport(data: ReportSchedule): Promise<{ success: boolean; scheduleId: string }> {
        const response = await api.post(`${this.baseUrl}/schedule`, data);
        return response.data;
    }
}

export default new SaaSAnalyticsService();
