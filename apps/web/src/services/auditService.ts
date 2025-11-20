import api from '../lib/api';

export interface AuditLogFilters {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resourceType?: string;
    complianceCategory?: string;
    riskLevel?: string;
    patientId?: string;
    reviewId?: string;
    startDate?: string;
    endDate?: string;
    ipAddress?: string;
    sort?: string;
}

export interface ExportAuditDataRequest {
    format: 'json' | 'csv' | 'pdf';
    startDate?: string;
    endDate?: string;
    filters?: {
        userId?: string;
        action?: string;
        resourceType?: string;
        complianceCategory?: string;
        riskLevel?: string;
        patientId?: string;
        reviewId?: string;
        ipAddress?: string;
    };
    includeDetails?: boolean;
    includeSensitiveData?: boolean;
}

export interface AuditSummaryRequest {
    startDate?: string;
    endDate?: string;
}

export interface ComplianceReportRequest {
    startDate: string;
    endDate: string;
}

export interface HighRiskActivitiesRequest {
    hours?: number;
}

export interface SuspiciousActivitiesRequest {
    hours?: number;
}

export interface UserActivityRequest {
    userId: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}

export interface PatientAccessLogRequest {
    patientId: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}

class AuditService {
    /**
     * Get audit logs with filtering and pagination
     */
    async getAuditLogs(filters: AuditLogFilters = {}) {
        const params = new URLSearchParams();

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, value.toString());
            }
        });

        const response = await api.get(`/audit/logs?${params.toString()}`);
        return response.data;
    }

    /**
     * Get audit summary and statistics
     */
    async getAuditSummary(request: AuditSummaryRequest = {}) {
        const params = new URLSearchParams();

        if (request.startDate) params.append('startDate', request.startDate);
        if (request.endDate) params.append('endDate', request.endDate);

        const response = await api.get(`/audit/summary?${params.toString()}`);
        return response.data.data;
    }

    /**
     * Get comprehensive compliance report
     */
    async getComplianceReport(request: ComplianceReportRequest) {
        const params = new URLSearchParams();
        params.append('startDate', request.startDate);
        params.append('endDate', request.endDate);

        const response = await api.get(`/audit/compliance-report?${params.toString()}`);
        return response.data.data;
    }

    /**
     * Get recent high-risk activities
     */
    async getHighRiskActivities(request: HighRiskActivitiesRequest = {}) {
        const params = new URLSearchParams();

        if (request.hours) params.append('hours', request.hours.toString());

        const response = await api.get(`/audit/high-risk-activities?${params.toString()}`);
        return response.data.data;
    }

    /**
     * Get suspicious activity patterns
     */
    async getSuspiciousActivities(request: SuspiciousActivitiesRequest = {}) {
        const params = new URLSearchParams();

        if (request.hours) params.append('hours', request.hours.toString());

        const response = await api.get(`/audit/suspicious-activities?${params.toString()}`);
        return response.data.data;
    }

    /**
     * Export audit data for compliance
     */
    async exportAuditData(request: ExportAuditDataRequest) {
        const response = await api.post('/audit/export', request, {
            responseType: request.format === 'pdf' ? 'json' : 'blob',
        });

        if (request.format === 'pdf') {
            // For PDF, return the structured data for frontend processing
            return response.data.data;
        } else {
            // For JSON and CSV, return the blob data
            return response.data;
        }
    }

    /**
     * Get specific user's audit trail
     */
    async getUserActivity(request: UserActivityRequest) {
        const params = new URLSearchParams();

        if (request.page) params.append('page', request.page.toString());
        if (request.limit) params.append('limit', request.limit.toString());
        if (request.startDate) params.append('startDate', request.startDate);
        if (request.endDate) params.append('endDate', request.endDate);

        const response = await api.get(`/audit/user-activity/${request.userId}?${params.toString()}`);
        return response.data;
    }

    /**
     * Get patient data access audit trail
     */
    async getPatientAccessLog(request: PatientAccessLogRequest) {
        const params = new URLSearchParams();

        if (request.page) params.append('page', request.page.toString());
        if (request.limit) params.append('limit', request.limit.toString());
        if (request.startDate) params.append('startDate', request.startDate);
        if (request.endDate) params.append('endDate', request.endDate);

        const response = await api.get(`/audit/patient-access/${request.patientId}?${params.toString()}`);
        return response.data;
    }

    /**
     * Get list of available audit actions for filtering
     */
    async getAuditActions() {
        const response = await api.get('/audit/actions');
        return response.data.data;
    }

    /**
     * Generate PDF report from audit data
     */
    async generatePDFReport(data: unknown): Promise<Blob> {
        // This would typically use a PDF generation library like jsPDF or react-pdf
        // For now, we'll create a simple text-based PDF
        const content = this.formatAuditDataForPDF(data);

        // In a real implementation, you would use a proper PDF library
        const blob = new Blob([content], { type: 'application/pdf' });
        return blob;
    }

    /**
     * Format audit data for PDF export
     */
    private formatAuditDataForPDF(data: unknown): string {
        let content = `MTR Audit Trail Report\n`;
        content += `Generated: ${new Date().toLocaleString()}\n\n`;

        if (data.title) {
            content += `${data.title}\n\n`;
        }

        if (data.dateRange) {
            content += `Date Range: ${new Date(data.dateRange.start).toLocaleDateString()} - ${new Date(data.dateRange.end).toLocaleDateString()}\n\n`;
        }

        if (data.summary) {
            content += `Summary:\n`;
            content += `Total Logs: ${data.summary.totalLogs}\n`;
            content += `Unique Users: ${data.summary.uniqueUserCount}\n`;
            content += `Error Rate: ${data.summary.errorRate?.toFixed(1)}%\n`;
            content += `Compliance Score: ${data.summary.complianceScore}\n\n`;
        }

        if (data.logs && data.logs.length > 0) {
            content += `Audit Logs:\n`;
            content += `${'='.repeat(80)}\n`;

            data.logs.forEach((log: unknown, index: number) => {
                content += `${index + 1}. ${log.actionDisplay || log.action}\n`;
                content += `   Timestamp: ${new Date(log.timestamp).toLocaleString()}\n`;
                content += `   User: ${log.userId?.firstName} ${log.userId?.lastName} (${log.userRole})\n`;
                content += `   Resource: ${log.resourceType}\n`;
                content += `   Risk Level: ${log.riskLevelDisplay || log.riskLevel}\n`;
                content += `   Category: ${log.complianceCategoryDisplay || log.complianceCategory}\n`;
                if (log.ipAddress) {
                    content += `   IP Address: ${log.ipAddress}\n`;
                }
                if (log.errorMessage) {
                    content += `   Error: ${log.errorMessage}\n`;
                }
                content += `\n`;
            });
        }

        return content;
    }

    /**
     * Download file with given content and filename
     */
    downloadFile(content: string | Blob, filename: string, contentType: string) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Format date for API requests
     */
    formatDateForAPI(date: Date): string {
        return date.toISOString();
    }

    /**
     * Parse date from API response
     */
    parseDateFromAPI(dateString: string): Date {
        return new Date(dateString);
    }

    /**
     * Get risk level color for UI
     */
    getRiskLevelColor(riskLevel: string): 'error' | 'warning' | 'info' | 'success' | 'default' {
        switch (riskLevel) {
            case 'critical':
                return 'error';
            case 'high':
                return 'warning';
            case 'medium':
                return 'info';
            case 'low':
                return 'success';
            default:
                return 'default';
        }
    }

    /**
     * Get compliance category display name
     */
    getComplianceCategoryDisplay(category: string): string {
        const categoryMap: { [key: string]: string } = {
            clinical_documentation: 'Clinical Documentation',
            patient_safety: 'Patient Safety',
            data_access: 'Data Access',
            system_security: 'System Security',
            workflow_compliance: 'Workflow Compliance',
        };

        return categoryMap[category] || category;
    }

    /**
     * Get action display name
     */
    getActionDisplay(action: string): string {
        const actionMap: { [key: string]: string } = {
            CREATE_MTR_SESSION: 'Created MTR Session',
            UPDATE_MTR_SESSION: 'Updated MTR Session',
            DELETE_MTR_SESSION: 'Deleted MTR Session',
            COMPLETE_MTR_SESSION: 'Completed MTR Session',
            CREATE_MTR_PROBLEM: 'Identified Drug Therapy Problem',
            UPDATE_MTR_PROBLEM: 'Updated Drug Therapy Problem',
            RESOLVE_MTR_PROBLEM: 'Resolved Drug Therapy Problem',
            DELETE_MTR_PROBLEM: 'Deleted Drug Therapy Problem',
            CREATE_MTR_INTERVENTION: 'Recorded Intervention',
            UPDATE_MTR_INTERVENTION: 'Updated Intervention',
            DELETE_MTR_INTERVENTION: 'Deleted Intervention',
            CREATE_MTR_FOLLOWUP: 'Scheduled Follow-up',
            UPDATE_MTR_FOLLOWUP: 'Updated Follow-up',
            COMPLETE_MTR_FOLLOWUP: 'Completed Follow-up',
            DELETE_MTR_FOLLOWUP: 'Deleted Follow-up',
            ACCESS_PATIENT_DATA: 'Accessed Patient Data',
            EXPORT_MTR_DATA: 'Exported MTR Data',
            LOGIN: 'User Login',
            LOGOUT: 'User Logout',
            FAILED_LOGIN: 'Failed Login Attempt',
        };

        return actionMap[action] || action;
    }
}

export const auditService = new AuditService();