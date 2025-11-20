import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  targetType?: string;
  conversationId?: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: string;
  complianceCategory?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: AuditLogFilters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/logs?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(filters: AuditLogFilters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/logs/export?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        responseType: 'blob',
      }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-logs-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  /**
   * Get audit logs for a specific conversation
   */
  async getConversationAuditLogs(conversationId: string, options: {
    limit?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/conversations/${conversationId}/logs?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Get high-risk activities
   */
  async getHighRiskActivities(startDate: string, endDate: string) {
    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/high-risk?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },

  /**
   * Get HIPAA compliance report
   */
  async getComplianceReport(startDate: string, endDate: string) {
    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/compliance-report?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data;
  },

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string, startDate: string, endDate: string) {
    const response = await axios.get(
      `${API_BASE_URL}/chat/audit/users/${userId}/activity?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    return response.data.data;
  },
};
