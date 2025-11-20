import api, { ApiResponse } from './api';

/**
 * Super Admin Audit Service
 * Handles all API calls for the unified audit trail
 */

export interface AuditLog {
    _id: string;
    userId: string;
    userDetails: {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        workplaceRole?: string;
        avatarUrl?: string;
    };
    workplaceId?: string;
    workplaceDetails?: {
        workplaceId: string;
        name: string;
        type?: string;
    };
    activityType: string;
    action: string;
    description: string;
    targetEntity?: {
        entityType: string;
        entityId: string;
        entityName: string;
        additionalInfo?: Record<string, any>;
    };
    changes?: Array<{
        field: string;
        oldValue: any;
        newValue: any;
    }>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    requestMethod?: string;
    requestPath?: string;
    responseStatus?: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceCategory?: 'HIPAA' | 'SOX' | 'GDPR' | 'PCI_DSS' | 'GENERAL';
    success: boolean;
    errorMessage?: string;
    timestamp: string;
    flagged: boolean;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    sessionId?: string;
    location?: {
        country?: string;
        region?: string;
        city?: string;
    };
}

export interface AuditStats {
    totalActivities: number;
    activityByType: Array<{ _id: string; count: number }>;
    activityByRisk: Array<{ _id: string; count: number }>;
    failedActivities: number;
    flaggedActivities: number;
    topUsers: Array<{
        _id: string;
        count: number;
        userDetails: {
            firstName: string;
            lastName: string;
            email: string;
            role: string;
        };
    }>;
    recentCriticalEvents: AuditLog[];
    activityTrend: Array<{
        _id: { date: string };
        count: number;
    }>;
}

export interface AuditFilters {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    userId?: string;
    workplaceId?: string;
    activityType?: string;
    action?: string;
    riskLevel?: string;
    success?: boolean;
    flagged?: boolean;
    complianceCategory?: string;
    searchQuery?: string;
    entityType?: string;
    entityId?: string;
}

export interface AuditTrailResponse {
    logs: AuditLog[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

class SuperAdminAuditService {
    /**
     * Get audit trail with filters
     */
    async getAuditTrail(filters: AuditFilters = {}): Promise<AuditTrailResponse> {
        const response = await api.get<ApiResponse<AuditTrailResponse>>(
            '/super-admin/audit-trail',
            { params: filters }
        );
        return response.data.data!;
    }

    /**
     * Get audit statistics
     */
    async getAuditStats(
        workplaceId?: string,
        startDate?: string,
        endDate?: string
    ): Promise<AuditStats> {
        const response = await api.get<ApiResponse<AuditStats>>(
            '/super-admin/audit-trail/stats',
            {
                params: {
                    workplaceId,
                    startDate,
                    endDate,
                },
            }
        );
        return response.data.data!;
    }

    /**
     * Export audit data
     */
    async exportAuditData(
        filters: AuditFilters = {},
        format: 'json' | 'csv' = 'json'
    ): Promise<Blob> {
        const response = await api.get('/super-admin/audit-trail/export', {
            params: { ...filters, format },
            responseType: 'blob',
        });
        return response.data;
    }

    /**
     * Get user activity timeline
     */
    async getUserActivityTimeline(
        userId: string,
        limit: number = 100
    ): Promise<{ userId: string; activities: AuditLog[]; total: number }> {
        const response = await api.get<
            ApiResponse<{ userId: string; activities: AuditLog[]; total: number }>
        >(`/super-admin/audit-trail/users/${userId}`, {
            params: { limit },
        });
        return response.data.data!;
    }

    /**
     * Get entity activity history
     */
    async getEntityActivityHistory(
        entityType: string,
        entityId: string,
        limit: number = 100
    ): Promise<{ entityType: string; entityId: string; activities: AuditLog[]; total: number }> {
        const response = await api.get<
            ApiResponse<{ entityType: string; entityId: string; activities: AuditLog[]; total: number }>
        >(`/super-admin/audit-trail/entities/${entityType}/${entityId}`, {
            params: { limit },
        });
        return response.data.data!;
    }

    /**
     * Search audit logs
     */
    async searchAuditLogs(
        query: string,
        limit: number = 50
    ): Promise<{ query: string; results: AuditLog[]; total: number }> {
        const response = await api.get<
            ApiResponse<{ query: string; results: AuditLog[]; total: number }>
        >('/super-admin/audit-trail/search', {
            params: { q: query, limit },
        });
        return response.data.data!;
    }

    /**
     * Flag audit entry
     */
    async flagAuditEntry(auditId: string, flagged: boolean = true): Promise<AuditLog> {
        const response = await api.put<ApiResponse<AuditLog>>(
            `/super-admin/audit-trail/${auditId}/flag`,
            { flagged }
        );
        return response.data.data!;
    }

    /**
     * Review audit entry
     */
    async reviewAuditEntry(auditId: string, reviewNotes: string): Promise<AuditLog> {
        const response = await api.put<ApiResponse<AuditLog>>(
            `/super-admin/audit-trail/${auditId}/review`,
            { reviewNotes }
        );
        return response.data.data!;
    }

    /**
     * Get activity types
     */
    async getActivityTypes(): Promise<string[]> {
        const response = await api.get<ApiResponse<string[]>>(
            '/super-admin/audit-trail/activity-types'
        );
        return response.data.data!;
    }

    /**
     * Get risk levels
     */
    async getRiskLevels(): Promise<string[]> {
        const response = await api.get<ApiResponse<string[]>>(
            '/super-admin/audit-trail/risk-levels'
        );
        return response.data.data!;
    }

    /**
     * Download exported file
     */
    downloadFile(blob: Blob, filename: string): void {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
}

export default new SuperAdminAuditService();
