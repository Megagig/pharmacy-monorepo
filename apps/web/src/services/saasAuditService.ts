import { api } from '../lib/api';

/**
 * SaaS Audit Service
 * Handles audit logs, compliance reports, and flagged entries
 */

// Types
export interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    action: string;
    resource: string;
    success: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'user_management' | 'system';
    ipAddress: string;
    userAgent: string;
    workspaceId?: string;
    metadata: Record<string, any>;
    flagged: boolean;
    timestamp: Date;
}

export interface AuditSummary {
    totalLogs: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    bySuccess: {
        successful: number;
        failed: number;
    };
    flaggedCount: number;
    trends: Array<{
        date: string;
        count: number;
        failed: number;
    }>;
}

export interface ComplianceReport {
    reportId: string;
    generatedAt: Date;
    timeRange: {
        start: string;
        end: string;
    };
    summary: {
        totalEvents: number;
        securityIncidents: number;
        accessViolations: number;
        dataAccess: number;
    };
    incidents: Array<{
        type: string;
        severity: string;
        count: number;
        details: string[];
    }>;
    recommendations: string[];
}

class SaaSAuditService {
    private baseUrl = '/admin/saas/audit';

    /**
     * Get audit logs with advanced filtering
     */
    async getAuditLogs(params?: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        resource?: string;
        success?: boolean;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        category?: string;
        startDate?: string;
        endDate?: string;
        ipAddress?: string;
        workspaceId?: string;
        flagged?: boolean;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ logs: AuditLog[]; pagination: any }> {
        const response = await api.get(`${this.baseUrl}/logs`, { params });
        return response.data;
    }

    /**
     * Get audit summary and statistics
     */
    async getAuditSummary(timeRange?: '7d' | '30d' | '90d' | '1y'): Promise<AuditSummary> {
        const response = await api.get(`${this.baseUrl}/summary`, {
            params: { timeRange }
        });
        return response.data;
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(options?: {
        timeRange?: '7d' | '30d' | '90d' | '1y';
        includeIncidents?: boolean;
        includeAccessPatterns?: boolean;
        includeDataAccess?: boolean;
        format?: 'json' | 'pdf' | 'excel';
    }): Promise<ComplianceReport | Blob> {
        const response = await api.post(`${this.baseUrl}/compliance-report`, options, {
            responseType: options?.format && options.format !== 'json' ? 'blob' : 'json'
        });
        return response.data;
    }

    /**
     * Review and resolve flagged audit entry
     */
    async reviewAuditLog(logId: string, resolution: string, notes?: string): Promise<{ success: boolean }> {
        const response = await api.put(`${this.baseUrl}/logs/${logId}/review`, {
            resolution,
            notes
        });
        return response.data;
    }

    /**
     * Get flagged audit entries requiring review
     */
    async getFlaggedAuditLogs(limit?: number): Promise<{ logs: AuditLog[] }> {
        const response = await api.get(`${this.baseUrl}/flagged`, {
            params: { limit }
        });
        return response.data;
    }

    /**
     * Export audit logs
     */
    async exportAuditLogs(options: {
        format: 'csv' | 'excel';
        filters?: Record<string, any>;
        includeDetails?: boolean;
    }): Promise<Blob> {
        const response = await api.post(`${this.baseUrl}/export`, options, {
            responseType: 'blob'
        });
        return response.data;
    }
}

export default new SaaSAuditService();
